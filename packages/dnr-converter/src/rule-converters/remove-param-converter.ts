import { type DeclarativeRule } from '../declarative-rule';
import { type NetworkRule } from '../network-rule';

import { type ConvertedRules } from './converted-rules';
import { RuleConverter } from './rule-converter';

/**
 * Describes how to convert `$removeparam` rules.
 *
 * @see {@link RuleConverter} parent class.
 */
export class RemoveParamConverter extends RuleConverter {
    /**
     * Creates rule template for grouping similar `$removeparam` rules.
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
         * Also delete remove params options as they may differ
         * between rules but still should be grouped together.
         */
        delete template.id;
        delete template.action?.redirect?.transform?.queryTransform?.removeParams;

        return JSON.stringify(template);
    }

    /**
     * Combines two similar `$removeparam` {@link DeclarativeRule}
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

        // Merge remove params from {@link ruleToMerge} into {@link resultRule}
        const paramsToMerge = ruleToMerge.action.redirect?.transform?.queryTransform?.removeParams;
        if (paramsToMerge && paramsToMerge.length > 0) {
            resultRule.action.redirect?.transform?.queryTransform?.removeParams?.push(...paramsToMerge);
        }

        return resultRule;
    }

    /**
     * Converts {@link NetworkRule} grouped by `$removeparam` into {@link DeclarativeRule}.
     * For each rule looks for similar rules and groups them into a new rule.
     *
     * @param filterListId Filter list ID.
     * @param rules List of {@link NetworkRule}.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     *
     * @returns Converted rules.
     */
    public async convert(
        filterListId: number,
        rules: NetworkRule[],
        usedIds: Set<number>,
    ): Promise<ConvertedRules> {
        const converted = await this.convertRules(filterListId, rules, usedIds);
        const result = RuleConverter.groupConvertedRules(
            converted,
            RemoveParamConverter.createRuleTemplate,
            RemoveParamConverter.combineRulePair,
        );
        return result;
    }
}
