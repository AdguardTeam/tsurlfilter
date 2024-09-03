import type { IndexedNetworkRuleWithHash } from '../network-indexed-rule-with-hash';
import { DeclarativeRule } from '../declarative-rule';
import { ConvertedRules } from '../converted-result';

import { DeclarativeRuleConverter } from './abstract-rule-converter';

/**
 * Describes how to convert $removeparam rules.
 */
export class RemoveParamRulesConverter extends DeclarativeRuleConverter {
    /**
     * Converts indexed rules grouped by $removeparam into declarative rules:
     * for each rule looks for similar rules and groups them into a new rule.
     *
     * @param filterId Filter id.
     * @param rules List of indexed network rules with hash.
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
            // Note: Partial type is used because we need to delete some fields,
            // but we cannot mark them as optional in the parent type.
            const template: Partial<DeclarativeRule> = JSON.parse(JSON.stringify(rule));

            delete template.id;
            delete template.action?.redirect?.transform?.queryTransform?.removeParams;

            return JSON.stringify(template);
        };

        const combineRulePair = (sourceRule: DeclarativeRule, ruleToMerge: DeclarativeRule): DeclarativeRule => {
            const resultRule: DeclarativeRule = JSON.parse(JSON.stringify(sourceRule));

            const params = ruleToMerge.action.redirect?.transform?.queryTransform?.removeParams || [];

            resultRule.action.redirect?.transform?.queryTransform?.removeParams?.push(...params);

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
