import { NetworkRuleOption } from '../../network-rule';
import { type ConvertedRules } from '../converted-result';
import { type DeclarativeRule, type RequestMethod, RuleActionType } from '../declarative-rule';
import type { IndexedNetworkRuleWithHash } from '../network-indexed-rule-with-hash';
import { type NetworkRuleWithNodeAndText } from '../network-rule-with-node-and-text';
import { convertUrlTransformToDnr, isFullUrlPattern, parseUrlTransformParts } from '../url-transform-converter';

import { AbstractRuleConverter } from './abstract-rule-converter';

/**
 * Describes how to convert $urltransform rules.
 *
 * Overrides {@link AbstractRuleConverter.convertRule} to apply
 * urltransform-specific post-processing:
 * - Replaces the urlFilter-based condition with a regexFilter from the
 *   DNR conversion result.
 * - Preserves domain scope by extracting the domain from the original
 *   pattern and adding it to requestDomains.
 * - Defaults full-URL (origin-changing) rules to GET-only when no
 *   explicit $method modifier is set.
 * - Generates additional declarative rules for multi-stage pipelines.
 */
export class UrlTransformRulesConverter extends AbstractRuleConverter {
    /**
     * Converts indexed rules grouped by $urltransform into declarative rules.
     *
     * @param filterId Filter id.
     * @param rules List of indexed network rules with hash.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     *
     * @returns Converted rules.
     */
    public convert(
        filterId: number,
        rules: IndexedNetworkRuleWithHash[],
        usedIds: Set<number>,
    ): Promise<ConvertedRules> {
        return this.convertRules(filterId, rules, usedIds);
    }

    /**
     * Converts a single $urltransform network rule into one or more
     * declarative rules.
     *
     * First performs the generic conversion via
     * {@link AbstractRuleConverter.convertRule}, then applies
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
        rule: NetworkRuleWithNodeAndText,
    ): Promise<DeclarativeRule[]> {
        // Perform generic conversion (action, condition, priority, validation).
        const baseRules = await super.convertRule(id, rule);

        // Skip post-processing for allowlist rules or if base conversion
        // produced no rules.
        if (baseRules.length === 0 || rule.rule.isAllowlist()) {
            return baseRules;
        }

        const urlTransformValue = rule.rule.getAdvancedModifierValue();
        if (!urlTransformValue) {
            return baseRules;
        }

        const dnrResults = convertUrlTransformToDnr(urlTransformValue);
        if (dnrResults.length === 0) {
            return baseRules;
        }

        // Post-process the first (base) declarative rule.
        const declarativeRule = baseRules[0];

        UrlTransformRulesConverter.applyDomainScope(declarativeRule, rule);
        UrlTransformRulesConverter.applyMethodDefault(declarativeRule, rule, urlTransformValue);
        UrlTransformRulesConverter.applyRegexFilter(declarativeRule, dnrResults);

        const allRules = UrlTransformRulesConverter.buildPipelineStages(id, declarativeRule, dnrResults);
        await UrlTransformRulesConverter.validateAllStages(allRules, rule);

        return allRules;
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
        rule: NetworkRuleWithNodeAndText,
    ): void {
        if (declarativeRule.condition.requestDomains) {
            return;
        }

        const domain = AbstractRuleConverter.extractDomainFromPattern(
            rule.rule.getPattern(),
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
        rule: NetworkRuleWithNodeAndText,
        urlTransformValue: string,
    ): void {
        if (
            !rule.rule.isOptionEnabled(NetworkRuleOption.Method)
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
     * @param declarativeRule The base declarative rule.
     * @param dnrResults The DNR conversion results.
     *
     * @returns Array of all declarative rules (single or multi-stage).
     */
    private static buildPipelineStages(
        id: number,
        declarativeRule: DeclarativeRule,
        dnrResults: ReturnType<typeof convertUrlTransformToDnr>,
    ): DeclarativeRule[] {
        const allRules: DeclarativeRule[] = [declarativeRule];

        // Multi-stage pipeline: generate additional rules for stages 2+.
        for (let stageIdx = 1; stageIdx < dnrResults.length; stageIdx += 1) {
            const stageResult = dnrResults[stageIdx];
            const stageRule: DeclarativeRule = {
                id: id + stageIdx,
                action: {
                    type: RuleActionType.REDIRECT,
                    redirect: { regexSubstitution: stageResult.regexSubstitution },
                },
                condition: { ...declarativeRule.condition },
            };
            stageRule.condition.regexFilter = stageResult.regexFilter;
            if (stageResult.isUrlFilterCaseSensitive !== undefined) {
                stageRule.condition.isUrlFilterCaseSensitive = stageResult.isUrlFilterCaseSensitive;
            }
            if (declarativeRule.priority) {
                stageRule.priority = declarativeRule.priority;
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
        rule: NetworkRuleWithNodeAndText,
    ): Promise<void> {
        for (const stageRule of allRules) {
            // eslint-disable-next-line no-await-in-loop
            const stageErr = await AbstractRuleConverter.checkDeclarativeRuleApplicable(
                rule,
                stageRule,
            );
            if (stageErr) {
                throw stageErr;
            }
        }
    }
}
