import type { IndexedNetworkRuleWithHash } from '../network-indexed-rule-with-hash';
import { DeclarativeRule } from '../declarative-rule';
import { ConvertedRules } from '../converted-result';
import { CSP_HEADER_NAME } from '../../../modifiers/csp-modifier';

import { DeclarativeRuleConverter } from './abstract-rule-converter';

/**
 * Describes how to convert $csp rules.
 */
export class CspRulesConverter extends DeclarativeRuleConverter {
    /**
     * Converts indexed rules grouped by $csp into declarative rules:
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
        rules: IndexedNetworkRuleWithHash[],
        offsetId: number,
    ): ConvertedRules {
        const createRuleTemplate = (rule: DeclarativeRule): string => {
            // Deep copy without relation to source rule
            const template = JSON.parse(JSON.stringify(rule));

            delete template.id;
            // Converted $csp rules contain only one response headers action.
            delete template.action.responseHeaders[0].value;

            return JSON.stringify(template);
        };

        const combineRulePair = (sourceRule: DeclarativeRule, ruleToMerge: DeclarativeRule): DeclarativeRule => {
            const resultRule: DeclarativeRule = JSON.parse(JSON.stringify(sourceRule));

            // If the headers are empty in the rule to merge, do not take any action.
            if (!ruleToMerge.action.responseHeaders || ruleToMerge.action.responseHeaders.length === 0) {
                return resultRule;
            }

            // Try to find CSP header in the rule to merge - if not found, do not take any action.
            const cspHeaderToMerge = ruleToMerge.action.responseHeaders
                .find((h) => h.header === CSP_HEADER_NAME);
            if (!cspHeaderToMerge) {
                return resultRule;
            }

            // Combine the CSP header from the rule to merge with a copy of the source rule.
            if (resultRule.action.responseHeaders && resultRule.action.responseHeaders.length > 0) {
                const idx = resultRule.action.responseHeaders
                    .findIndex((h) => h.header === CSP_HEADER_NAME);
                if (idx === -1) {
                    return resultRule;
                }

                const cspHeaderValue = resultRule.action.responseHeaders[idx].value;
                if (cspHeaderValue) {
                    resultRule.action.responseHeaders[idx].value = `${cspHeaderValue}; ${cspHeaderToMerge.value}`;
                } else {
                    resultRule.action.responseHeaders[idx].value = cspHeaderToMerge.value;
                }
            } else {
                resultRule.action.responseHeaders = [cspHeaderToMerge];
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
