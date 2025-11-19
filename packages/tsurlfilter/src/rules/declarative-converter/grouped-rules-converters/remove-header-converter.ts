import type { IndexedNetworkRuleWithHash } from '../network-indexed-rule-with-hash';
import { type DeclarativeRule } from '../declarative-rule';
import { type ConvertedRules } from '../converted-result';

import { AbstractRuleConverter } from './abstract-rule-converter';

/**
 * Describes how to convert $removeheader rules.
 *
 * TODO: Add checks for rules containing the $removeheader and
 * incompatible modifiers: '$domain', '$third-party', '$important', '$app',
 * '$match-case', '$script', '$stylesheet, etc.
 *
 */
export class RemoveHeaderRulesConverter extends AbstractRuleConverter {
    /**
     * Converts indexed rules grouped by $removeheader into declarative rules:
     * for each rule looks for similar rules and groups them into a new rule.
     *
     * @param filterId Filter id.
     * @param rules List of indexed network rules with hash.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     *
     * @returns Converted rules.
     */
    public async convert(
        filterId: number,
        rules: IndexedNetworkRuleWithHash[],
        usedIds: Set<number>,
    ): Promise<ConvertedRules> {
        const createRuleTemplate = (rule: DeclarativeRule): string => {
            // Deep copy without relation to source rule
            const template = JSON.parse(JSON.stringify(rule));

            delete template.id;
            delete template.action.requestHeaders;
            delete template.action.responseHeaders;

            return JSON.stringify(template);
        };

        const combineRulePair = (sourceRule: DeclarativeRule, ruleToMerge: DeclarativeRule): DeclarativeRule => {
            const resultRule: DeclarativeRule = JSON.parse(JSON.stringify(sourceRule));

            const { responseHeaders, requestHeaders } = ruleToMerge.action;
            if (responseHeaders) {
                if (resultRule.action.responseHeaders) {
                    resultRule.action.responseHeaders.push(...responseHeaders);
                } else {
                    resultRule.action.responseHeaders = responseHeaders;
                }
            }
            if (requestHeaders) {
                if (resultRule.action.requestHeaders) {
                    resultRule.action.requestHeaders.push(...requestHeaders);
                } else {
                    resultRule.action.requestHeaders = requestHeaders;
                }
            }

            return resultRule;
        };

        const converted = await this.convertRules(filterId, rules, usedIds);

        const result = this.groupConvertedRules(
            converted,
            createRuleTemplate,
            combineRulePair,
        );

        return result;
    }
}
