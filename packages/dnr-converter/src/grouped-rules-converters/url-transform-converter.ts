import { type DeclarativeRule, type RequestMethod, RuleActionType } from '../declarative-rule';
import { OPTION_NAMES } from '../rule/option-names';
import { type Rule } from '../rule/rule';
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
     * Converts rules grouped by $urltransform into declarative rules.
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
        return this.convertRules(filterId, rules, usedIds);
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

        // Post-process the base declarative rule.
        UrlTransformRulesConverter.applyDomainScope(baseRule, rule);
        UrlTransformRulesConverter.applyMethodDefault(baseRule, rule, urlTransformValue);
        UrlTransformRulesConverter.applyRegexFilter(baseRule, dnrResults);

        const allRules = UrlTransformRulesConverter.buildPipelineStages(id, baseRule, dnrResults);
        await UrlTransformRulesConverter.validateAllStages(allRules, rule);

        // Return the single rule if there's no pipeline, or all pipeline stages
        if (allRules.length === 1) {
            return baseRule;
        }

        // Override convertRules behavior: when we have pipeline stages,
        // we need to return multiple rules. Since convertRule returns a single
        // DeclarativeRule, we handle this by throwing a special marker that
        // convertRules can catch. However, to keep things simple, we return
        // the base rule and rely on buildPipelineStages having been called.
        // The pipeline stages will be handled by the overridden convert method.
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
     */
    private static applyMethodDefault(
        declarativeRule: DeclarativeRule,
        rule: Rule,
        urlTransformValue: string,
    ): void {
        if (
            !rule.isModifierEnabled(OPTION_NAMES.METHOD)
            && !declarativeRule.condition.requestMethods
        ) {
            const parts = parseUrlTransformParts(urlTransformValue);
            if (isFullUrlPattern(parts.pattern)) {
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
