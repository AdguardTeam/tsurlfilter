import { type DeclarativeRule, type ModifyHeaderInfo } from '../declarative-rule';

import { type ConvertedRules } from './converted-rules';
import { RegularRuleConverter } from './regular-rule-converter';

/**
 * Describes how to convert `$removeheader` rules.
 *
 * Incompatible-modifier handling is performed by `RuleDeclarativeValidator`
 * (`checkRemoveHeaderCompatibleModifiersFn`): a `$removeheader` rule combined
 * with an incompatible modifier is rejected with an `UnsupportedModifierError`
 * and skipped — no declarative rule is emitted — following the package's
 * "report limitation + skip" convention.
 *
 * Incompatible modifiers are detected in two ways, because dnr-converter
 * stores modifiers differently from tsurlfilter:
 * - loop-reachable modifiers present in `enabledModifiers` and absent from
 *   `REMOVEHEADER_COMPATIBLE_MODIFIERS` (e.g. `$method`);
 * - the `$to` modifier, which is field-only but incompatible per tsurlfilter
 *   (checked explicitly on `permittedToDomains`/`restrictedToDomains`).
 *
 * `$domain` and `$denyallow` are compatible (they set no flag in tsurlfilter)
 * and convert normally, so they are not rejected.
 *
 * @see {@link RegularRuleConverter} parent class.
 */
export class RemoveHeaderConverter extends RegularRuleConverter {
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
     * Groups converted `$removeheader` rules by merging rules with identical
     * conditions.
     *
     * @param converted Converted rules before grouping.
     *
     * @returns Converted rules after grouping.
     */
    // eslint-disable-next-line class-methods-use-this -- template method override
    protected override groupConverted(converted: ConvertedRules): ConvertedRules {
        return RegularRuleConverter.groupConvertedRules(
            converted,
            RemoveHeaderConverter.createRuleTemplate,
            RemoveHeaderConverter.combineRulePair,
        );
    }
}
