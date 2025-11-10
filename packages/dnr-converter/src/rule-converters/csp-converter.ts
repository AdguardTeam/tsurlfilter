import { CSP_HEADER_NAME } from '../constants';
import { type DeclarativeRule, type ModifyHeaderInfo } from '../declarative-rule';
import { type NetworkRule } from '../network-rule';

import { type ConvertedRules } from './converted-rules';
import { RuleConverter } from './rule-converter';

/**
 * Describes how to convert `$csp` rules.
 *
 * @see {@link RuleConverter} parent class.
 */
export class CspConverter extends RuleConverter {
    /**
     * Creates rule template for grouping similar `$csp` rules.
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
         * Also remove value of the CSP header as they
         * may differ between rules but still should be grouped together.
         *
         * Note: Converted `$csp` rules contain only one response headers action.
         */
        delete template.id;
        delete template.action?.responseHeaders?.[0].value;

        return JSON.stringify(template);
    }

    /**
     * Finds CSP header in the provided header info.
     *
     * @param modifyHeaderInfo Modify header info to check.
     *
     * @returns `true` if the header is CSP header, `false` otherwise.
     */
    private static isCspHeader(modifyHeaderInfo: ModifyHeaderInfo) {
        return modifyHeaderInfo.header === CSP_HEADER_NAME;
    }

    /**
     * Combines two similar `$csp` {@link DeclarativeRule}
     * rules into one by merging their CSP header values.
     *
     * @param sourceRule The source rule to merge into.
     * @param ruleToMerge The rule to merge into the source rule.
     *
     * @returns The combined {@link DeclarativeRule}.
     */
    private static combineRulePair(sourceRule: DeclarativeRule, ruleToMerge: DeclarativeRule): DeclarativeRule {
        // Deep copy to drop references to source rule
        const resultRule: DeclarativeRule = JSON.parse(JSON.stringify(sourceRule));

        // If the headers are empty in the rule to merge, do not take any action
        const { responseHeaders: headersToMerge } = ruleToMerge.action;
        if (!headersToMerge || headersToMerge.length === 0) {
            return resultRule;
        }

        // Try to find CSP header in the rule to merge - if not found, do not take any action
        let cspHeaderInfoToMerge = headersToMerge.find(CspConverter.isCspHeader);
        if (!cspHeaderInfoToMerge) {
            return resultRule;
        }

        // Deep copy to avoid reference issues
        cspHeaderInfoToMerge = JSON.parse(JSON.stringify(cspHeaderInfoToMerge)) as ModifyHeaderInfo;

        /**
         * Check if the headers are empty in the result rule:
         * - if `true` - try to add CSP header if it exists in the result rule;
         * - if `false` - create new response headers array with only CSP header.
         */
        const { responseHeaders: resultHeaders } = resultRule.action;
        if (resultHeaders && resultHeaders.length > 0) {
            // Try to find CSP header in the result rule - if not found, do not take any action
            const cspHeaderIndex = resultHeaders.findIndex(CspConverter.isCspHeader);
            if (cspHeaderIndex === -1) {
                return resultRule;
            }

            /**
             * Check if the CSP header value is already set in the result rule:
             * - if `true` - append value from the rule to merge;
             * - if `false` - set value from the rule to merge.
             */
            const cspHeaderValue = resultHeaders[cspHeaderIndex].value;
            if (cspHeaderValue) {
                resultHeaders[cspHeaderIndex].value = `${cspHeaderValue}; ${cspHeaderInfoToMerge.value}`;
            } else {
                resultHeaders[cspHeaderIndex].value = cspHeaderInfoToMerge.value;
            }
        } else {
            resultRule.action.responseHeaders = [cspHeaderInfoToMerge];
        }

        return resultRule;
    }

    /**
     * Converts {@link NetworkRule} grouped by `$csp` into {@link DeclarativeRule}.
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
            CspConverter.createRuleTemplate,
            CspConverter.combineRulePair,
        );
        return result;
    }
}
