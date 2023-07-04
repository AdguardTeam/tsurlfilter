import { IndexedRule } from '../../rule';
import { DeclarativeRule } from '../declarative-rule';
import { ConvertedRules } from '../converted-result';

import { DeclarativeRuleConverter } from './abstract-rule-converter';

/**
 * Describes how to convert $removeheader rules.
 *
 * TODO: Add checks for rules containing the $removeheader and
 * incompatible modifiers: '$domain', '$third-party', '$important', '$app',
 * '$match-case', '$script', '$stylesheet, etc.
 *
 */
export class RemoveHeaderRulesConverter extends DeclarativeRuleConverter {
    /**
     * Converts indexed rules grouped by $removeheader into declarative rules:
     * for each rule looks for similar rules and groups them into a new rule.
     *
     * @param filterId Filter id.
     * @param rules List of indexed rules.
     * @param offsetId Offset for the IDs of the converted rules.
     *
     * @returns Converted rules.
     */
    public convert(
        filterId: number,
        rules: IndexedRule[],
        offsetId: number,
    ): ConvertedRules {
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

        const converted = this.convertRules(filterId, rules, offsetId);

        const result = this.groupConvertedRules(
            converted,
            createRuleTemplate,
            combineRulePair,
        );

        return result;
    }
}
