import { type DeclarativeRule, type ModifyHeaderInfo } from '../declarative-rule';
import { type NetworkRule } from '../network-rule';

import { type ConvertedRules } from './converted-rules';
import { RuleConverter } from './rule-converter';

/**
 * Describes how to convert `$removeheader` rules.
 *
 * TODO: Add checks for rules containing the `$removeheader` and
 * incompatible modifiers: `$domain`, `$third-party`, `$important`, `$app`,
 * `$match-case`, `$script`, `$stylesheet`, etc.
 *
 * @see {@link RuleConverter} parent class.
 */
export class RemoveHeaderConverter extends RuleConverter {
    /**
     * Creates rule template for grouping similar `$removeheader` rules.
     *
     * @param rule {@link DeclarativeRule} to create template from.
     *
     * @returns Stringified rule template.
     */
    private static createRuleTemplate(rule: DeclarativeRule): string {
        /**
         * Deep copy to drop references to source rule.
         *
         * Note: `Partial` type is used because we need to delete some fields,
         * but we cannot mark them as optional in the parent type.
         */
        const template: Partial<DeclarativeRule> = JSON.parse(JSON.stringify(rule));

        /**
         * Remove ID field from the template as it is unique
         * per rule and should not be used for grouping.
         * Also remove request and response headers as they
         * may differ between rules but still should be grouped together.
         */
        delete template.id;
        delete template.action?.requestHeaders;
        delete template.action?.responseHeaders;

        return JSON.stringify(template);
    }

    /**
     * Combines two similar `$removeheader` {@link DeclarativeRule}
     * rules into one by merging their response and request header values.
     *
     * @param sourceRule The source rule to merge into.
     * @param ruleToMerge The rule to merge into the source rule.
     *
     * @returns The combined {@link DeclarativeRule}.
     */
    private static combineRulePair(sourceRule: DeclarativeRule, ruleToMerge: DeclarativeRule): DeclarativeRule {
        // Deep copy to drop references to source rule
        const resultRule: DeclarativeRule = JSON.parse(JSON.stringify(sourceRule));

        /**
         * Merge response and request headers from {@link ruleToMerge} into {@link resultRule}:
         * - if headers exist in {@link resultRule} - append headers from {@link ruleToMerge};
         * - if headers do not exist in {@link resultRule} - set headers from {@link ruleToMerge}.
         */
        let {
            responseHeaders: responseHeadersToMerge,
            requestHeaders: requestHeadersToMerge,
        } = ruleToMerge.action;

        const {
            responseHeaders: resultResponseHeaders,
            requestHeaders: resultRequestHeaders,
        } = resultRule.action;

        if (responseHeadersToMerge) {
            // Deep copy to avoid reference issues
            responseHeadersToMerge = JSON.parse(JSON.stringify(responseHeadersToMerge)) as ModifyHeaderInfo[];

            if (resultResponseHeaders) {
                resultResponseHeaders.push(...responseHeadersToMerge);
            } else {
                resultRule.action.responseHeaders = responseHeadersToMerge;
            }
        }

        if (requestHeadersToMerge) {
            // Deep copy to avoid reference issues
            requestHeadersToMerge = JSON.parse(JSON.stringify(requestHeadersToMerge)) as ModifyHeaderInfo[];

            if (resultRequestHeaders) {
                resultRequestHeaders.push(...requestHeadersToMerge);
            } else {
                resultRule.action.requestHeaders = requestHeadersToMerge;
            }
        }

        return resultRule;
    }

    /**
     * Converts {@link NetworkRule} grouped by `$removeheader` into {@link DeclarativeRule}.
     * For each rule looks for similar rules and groups them into a new rule.
     *
     * @param filterListId Filter list ID.
     * @param rules List of {@link NetworkRule}.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     *
     * @returns Converted {@link ConvertedRules}.
     */
    public async convert(
        filterListId: number,
        rules: NetworkRule[],
        usedIds: Set<number>,
    ): Promise<ConvertedRules> {
        const converted = await this.convertRules(filterListId, rules, usedIds);
        const result = RuleConverter.groupConvertedRules(
            converted,
            RemoveHeaderConverter.createRuleTemplate,
            RemoveHeaderConverter.combineRulePair,
        );
        return result;
    }
}
