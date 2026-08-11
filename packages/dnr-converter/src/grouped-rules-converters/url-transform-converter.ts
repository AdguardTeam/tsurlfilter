import { type DeclarativeRule, type RequestMethod, RuleActionType } from '../declarative-rule';
import { isConversionError } from '../errors/conversion-errors';
import { OPTION_NAMES } from '../rule/option-names';
import { type Rule } from '../rule/rule';
import { RuleDeclarativeValidator } from '../rule/rule-validator';
import { type ConvertedRules } from '../rule-converters/converted-rules';
import { RegularRuleConverter } from '../rule-converters/regular-rule-converter';
import { convertUrlTransformToDnr, isFullUrlPattern, parseUrlTransformParts } from '../url-transform-converter';

/**
 * Describes how to convert $urltransform rules.
 *
 * Overrides {@link RegularRuleConverter.convertRule} to apply
 * urltransform-specific post-processing:
 * - Replaces the urlFilter-based condition with a regexFilter from the
 *   DNR conversion result.
 * - Preserves domain scope by extracting the domain from the original
 *   pattern and adding it to requestDomains.
 * - Defaults full-URL (origin-changing) rules to GET-only when no
 *   explicit $method modifier is set.
 * - Generates additional declarative rules for multi-stage pipelines.
 */
export class UrlTransformRulesConverter extends RegularRuleConverter {
    /**
     * Generates a unique ID for a rule using its text hash.
     *
     * @param rule The rule to generate an ID for.
     * @param usedIds Set of already-used IDs to avoid collisions.
     *
     * @returns A unique ID.
     */
    private static getUniqueId(rule: Rule, usedIds: Set<number>): number {
        let id = rule.getTextHash();
        let salt = 0;
        while (usedIds.has(id)) {
            salt += 1;
            id = rule.getTextHash(salt);
        }
        usedIds.add(id);
        return id;
    }

    /**
     * Wraps an error into a {@link ConversionError} if needed.
     *
     * @param index The rule index.
     * @param id The rule ID.
     * @param error The caught error.
     *
     * @returns The wrapped error.
     */
    private static wrapError(index: number, id: number, error: unknown): Error {
        if (isConversionError(error)) {
            return error;
        }
        if (error instanceof Error) {
            return error;
        }
        return new Error(`Error converting rule at index ${index}`);
    }

    /**
     * Converts rules grouped by $urltransform into declarative rules.
     *
     * Overrides the parent to handle multi-stage pipelines:
     * for each $urltransform rule, the base conversion produces one
     * declarative rule, and additional pipeline stages generate
     * extra rules with sequential IDs and their own source map entries.
     *
     * @param filterId Filter id.
     * @param rules List of rules.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     *
     * @returns Converted rules.
     */
    public override async convert(
        filterId: number,
        rules: Rule[],
        usedIds: Set<number>,
    ): Promise<ConvertedRules> {
        const res: ConvertedRules = {
            declarativeRules: [],
            errors: [],
            sourceMapValues: [],
        };

        for (const rule of rules) {
            const { index } = rule;
            const baseId = UrlTransformRulesConverter.getUniqueId(rule, usedIds);

            try {
                // Validate rule can be converted to DNR format
                if (!RuleDeclarativeValidator.shouldConvertRule(rule)) {
                    continue;
                }

                const urlTransformValue = rule.advancedModifierValue;
                const isUrlTransform = !rule.allowlist
                    && !!urlTransformValue
                    && rule.isModifierEnabled(OPTION_NAMES.URLTRANSFORM);

                let dnrResults: ReturnType<typeof convertUrlTransformToDnr> | null = null;
                if (isUrlTransform) {
                    dnrResults = convertUrlTransformToDnr(urlTransformValue!);
                }

                // Perform generic conversion (action, condition, priority, validation).
                // eslint-disable-next-line no-await-in-loop
                const baseRule = await super.convertRule(baseId, rule);

                // Skip urltransform post-processing for allowlist rules or when no DNR results
                if (!isUrlTransform || !dnrResults || dnrResults.length === 0) {
                    res.sourceMapValues.push({
                        declarativeRuleId: baseRule.id,
                        sourceRuleIndex: index,
                        filterId,
                    });
                    res.declarativeRules.push(baseRule);
                    continue;
                }

                // Fix the action: set redirect with regexSubstitution from DNR conversion
                baseRule.action = {
                    type: RuleActionType.Redirect,
                    redirect: { regexSubstitution: dnrResults[0].regexSubstitution },
                };

                // Apply urltransform-specific post-processing
                UrlTransformRulesConverter.applyDomainScope(baseRule, rule);
                UrlTransformRulesConverter.applyMethodDefault(baseRule, rule, urlTransformValue!, dnrResults);
                UrlTransformRulesConverter.applyRegexFilter(baseRule, dnrResults);

                // Build all pipeline stages
                const allRules = UrlTransformRulesConverter.buildPipelineStages(baseId, baseRule, dnrResults);

                // Reserve all pipeline-stage IDs to prevent collisions with
                // subsequent rules (baseId + stageIdx).
                allRules.forEach((r) => usedIds.add(r.id));

                // Validate all stages against DNR constraints
                // eslint-disable-next-line no-await-in-loop
                await UrlTransformRulesConverter.validateAllStages(allRules, rule);

                // Add source map entries for all pipeline stages
                for (let stageIdx = 0; stageIdx < allRules.length; stageIdx += 1) {
                    const stageRule = allRules[stageIdx];
                    res.sourceMapValues.push({
                        declarativeRuleId: stageRule.id,
                        sourceRuleIndex: index,
                        filterId,
                    });
                    res.declarativeRules.push(stageRule);
                }
            } catch (e) {
                const err = UrlTransformRulesConverter.wrapError(index, baseId, e);
                res.errors.push(err);
            }
        }

        return res;
    }

    /**
     * Converts a single $urltransform network rule into one or more
     * declarative rules.
     *
     * First performs the generic conversion via
     * {@link RegularRuleConverter.convertRule}, then applies
     * urltransform-specific post-processing:
     * - Replaces urlFilter with regexFilter from the DNR transform result.
     * - Preserves domain scope from the original pattern.
     * - Defaults full-URL mode rules to GET-only when no $method is set.
     * - Generates additional declarative rules for multi-stage pipelines.
     * - Re-validates all produced rules against DNR constraints.
     *
     * @param id Rule identifier.
     * @param rule Network rule.
     *
     * @returns A list of declarative rules.
     */
    protected override async convertRule(
        id: number,
        rule: Rule,
    ): Promise<DeclarativeRule> {
        // Perform generic conversion (action, condition, priority, validation).
        const baseRule = await super.convertRule(id, rule);

        // Skip post-processing for allowlist rules
        if (rule.allowlist) {
            return baseRule;
        }

        const urlTransformValue = rule.advancedModifierValue;
        if (!urlTransformValue) {
            return baseRule;
        }

        const dnrResults = convertUrlTransformToDnr(urlTransformValue);
        if (dnrResults.length === 0) {
            return baseRule;
        }

        // Fix the action: set redirect with regexSubstitution from DNR conversion
        baseRule.action = {
            type: RuleActionType.Redirect,
            redirect: { regexSubstitution: dnrResults[0].regexSubstitution },
        };

        // Post-process the base declarative rule.
        UrlTransformRulesConverter.applyDomainScope(baseRule, rule);
        UrlTransformRulesConverter.applyMethodDefault(baseRule, rule, urlTransformValue, dnrResults);
        UrlTransformRulesConverter.applyRegexFilter(baseRule, dnrResults);

        await UrlTransformRulesConverter.validateAllStages([baseRule], rule);

        return baseRule;
    }

    /**
     * Preserves domain scope from the original pattern by extracting the
     * domain and adding it to requestDomains so the rule doesn't apply
     * to all sites after urlFilter is replaced by regexFilter.
     *
     * @param declarativeRule The declarative rule to modify.
     * @param rule The original network rule.
     */
    private static applyDomainScope(
        declarativeRule: DeclarativeRule,
        rule: Rule,
    ): void {
        if (declarativeRule.condition.requestDomains) {
            return;
        }

        const domain = UrlTransformRulesConverter.extractDomainFromPattern(
            rule.pattern,
        );
        if (domain) {
            // eslint-disable-next-line no-param-reassign
            declarativeRule.condition.requestDomains = [domain];
        }
    }

    /**
     * Defaults full-URL (origin-changing) rules to GET-only when no
     * explicit $method modifier is set, preventing unintended redirects
     * that would discard POST/PUT request bodies.
     *
     * @param declarativeRule The declarative rule to modify.
     * @param rule The original network rule.
     * @param urlTransformValue The $urltransform modifier value.
     * @param dnrResults The DNR conversion results for all pipeline stages.
     */
    private static applyMethodDefault(
        declarativeRule: DeclarativeRule,
        rule: Rule,
        urlTransformValue: string,
        dnrResults: ReturnType<typeof convertUrlTransformToDnr>,
    ): void {
        if (
            !rule.isModifierEnabled(OPTION_NAMES.METHOD)
            && !declarativeRule.condition.requestMethods
        ) {
            const parts = parseUrlTransformParts(urlTransformValue);
            // Check the first stage (via pattern) and all subsequent stages
            // (via their DNR regexFilter) so that multi-stage pipelines where
            // only a later stage changes the URL origin also get the GET-only
            // default.
            const isAnyStageFullUrl = isFullUrlPattern(parts.pattern)
                || dnrResults.some((r) => /^\^https?/.test(r.regexFilter));
            if (isAnyStageFullUrl) {
                // eslint-disable-next-line no-param-reassign
                declarativeRule.condition.requestMethods = ['get' as RequestMethod];
            }
        }
    }

    /**
     * Replaces the urlFilter-based condition with regexFilter from the
     * DNR conversion result.
     *
     * @param declarativeRule The declarative rule to modify.
     * @param dnrResults The DNR conversion results.
     */
    private static applyRegexFilter(
        declarativeRule: DeclarativeRule,
        dnrResults: ReturnType<typeof convertUrlTransformToDnr>,
    ): void {
        // eslint-disable-next-line no-param-reassign
        delete declarativeRule.condition.urlFilter;
        // eslint-disable-next-line no-param-reassign
        declarativeRule.condition.regexFilter = dnrResults[0].regexFilter;
        if (dnrResults[0].isUrlFilterCaseSensitive !== undefined) {
            // eslint-disable-next-line no-param-reassign
            declarativeRule.condition.isUrlFilterCaseSensitive = dnrResults[0].isUrlFilterCaseSensitive;
        }
    }

    /**
     * Builds the full list of declarative rules for multi-stage pipelines.
     * Single-stage rules return an array with just the base rule.
     * Multi-stage pipelines generate additional rules for stages 2+.
     *
     * @param id Base rule identifier.
     * @param baseRule The base declarative rule.
     * @param dnrResults The DNR conversion results.
     *
     * @returns Array of all declarative rules (single or multi-stage).
     */
    private static buildPipelineStages(
        id: number,
        baseRule: DeclarativeRule,
        dnrResults: ReturnType<typeof convertUrlTransformToDnr>,
    ): DeclarativeRule[] {
        const allRules: DeclarativeRule[] = [baseRule];

        // Multi-stage pipeline: generate additional rules for stages 2+.
        for (let stageIdx = 1; stageIdx < dnrResults.length; stageIdx += 1) {
            const stageResult = dnrResults[stageIdx];
            const stageRule: DeclarativeRule = {
                id: id + stageIdx,
                action: {
                    type: RuleActionType.Redirect,
                    redirect: { regexSubstitution: stageResult.regexSubstitution },
                },
                condition: { ...baseRule.condition },
            };
            stageRule.condition.regexFilter = stageResult.regexFilter;
            if (stageResult.isUrlFilterCaseSensitive !== undefined) {
                stageRule.condition.isUrlFilterCaseSensitive = stageResult.isUrlFilterCaseSensitive;
            }
            if (baseRule.priority) {
                stageRule.priority = baseRule.priority;
            }
            allRules.push(stageRule);
        }

        return allRules;
    }

    /**
     * Validates all rules (including pipeline stages) against DNR
     * constraints (RE2 compatibility, empty resources, etc.).
     *
     * @param allRules All declarative rules to validate.
     * @param rule The original network rule.
     *
     * @throws Error if any rule fails validation.
     */
    private static async validateAllStages(
        allRules: DeclarativeRule[],
        rule: Rule,
    ): Promise<void> {
        for (const stageRule of allRules) {
            // eslint-disable-next-line no-await-in-loop
            const stageErr = await RegularRuleConverter.checkRuleApplication(
                rule,
                stageRule,
            );
            if (stageErr) {
                throw stageErr;
            }
        }
    }

    /**
     * Extracts the domain from a URL pattern string.
     *
     * Handles common adblock pattern formats:
     * - `||example.com^` → `example.com`.
     * - `example.com/path` → `example.com`.
     * - `https://example.com` → `example.com`.
     * - `/path` → null (no domain).
     *
     * @param pattern The URL pattern string.
     *
     * @returns The extracted domain, or null if no domain could be extracted.
     */
    private static extractDomainFromPattern(pattern: string): string | null {
        if (!pattern) {
            return null;
        }

        let workStr = pattern;

        // Remove leading || (domain name anchor)
        if (workStr.startsWith('||')) {
            workStr = workStr.slice(2);
        }

        // Extract domain part (up to first /, ^, or end)
        const domainEnd = workStr.search(/[/^]/);
        const domain = domainEnd === -1 ? workStr : workStr.slice(0, domainEnd);

        // Remove leading protocol if present (e.g., https:// or http://)
        const protocolMatch = domain.match(/^(?:https?:)?\/\/(.+)/);
        if (protocolMatch) {
            return protocolMatch[1] || null;
        }

        // Remove port number if present
        const portIdx = domain.indexOf(':');
        if (portIdx !== -1) {
            return domain.slice(0, portIdx) || null;
        }

        return domain || null;
    }
}
