import { NetworkRule } from '../../network-rule';
import { IndexedRule } from '../../rule';
import {
    ConversionError,
    EmptyResourcesError,
    TooComplexRegexpError,
    UnsupportedModifierError,
    UnsupportedRegexpError,
} from '../errors/conversion-errors';
import { DeclarativeRule } from '../declarative-rule';
import { Source } from '../source-map';
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
     * @param rules List of indexed rules.
     * @param offsetId Offset for the IDs of the converted rules.
     *
     * @returns Converted rules.
     */
    // eslint-disable-next-line class-methods-use-this
    public convertRules(
        filterId: number,
        rules: IndexedRule[],
        offsetId: number,
    ): ConvertedRules {
        const sourceMapValues: Source[] = [];
        const rulesTemplates = new Map<string, DeclarativeRule>();
        const errors: (ConversionError | Error)[] = [];
        let regexpRulesCount = 0;

        const getRuleTemplate = (rule: DeclarativeRule): string => {
            // Deep copy without relation to source rule
            const template = JSON.parse(JSON.stringify(rule));

            template.id = 0;
            delete template.action.redirect?.transform?.queryTransform?.removeParams;

            return JSON.stringify(template);
        };

        const findRulePairId = (rule: DeclarativeRule): number | null => {
            const template = getRuleTemplate(rule);
            const ruleToJoin = rulesTemplates.get(template);

            if (!ruleToJoin) {
                return null;
            }

            // If found rule-sibling to join
            const params = rule.action.redirect?.transform?.queryTransform?.removeParams || [];
            // Then combine remove params
            ruleToJoin.action.redirect?.transform?.queryTransform?.removeParams?.push(...params);

            return ruleToJoin.id;
        };

        rules.forEach(({ rule, index }: IndexedRule) => {
            const id = offsetId + index;
            let converted: DeclarativeRule[] = [];

            try {
                converted = this.convertRule(
                    rule as NetworkRule,
                    id,
                );
            } catch (e) {
                if (e instanceof EmptyResourcesError
                    || e instanceof TooComplexRegexpError
                    || e instanceof UnsupportedModifierError
                    || e instanceof UnsupportedRegexpError
                ) {
                    errors.push(e);
                    return;
                }

                const msg = 'Non-categorized error during a conversion rule: '
                    + `${rule.getText()} (index - ${index}, id - ${id})`;
                errors.push(new Error(msg, { cause: e as Error }));
                return;
            }

            converted.forEach((dRule) => {
                const dRuleSiblingId = findRulePairId(dRule);

                if (dRuleSiblingId === null) {
                    const template = getRuleTemplate(dRule);
                    rulesTemplates.set(template, dRule);
                }

                sourceMapValues.push({
                    declarativeRuleId: dRuleSiblingId !== null
                        ? dRuleSiblingId
                        : dRule.id,
                    sourceRuleIndex: index,
                    filterId,
                });

                if (dRule.condition.regexFilter && dRuleSiblingId !== null) {
                    regexpRulesCount += 1;
                }
            });
        });

        return {
            sourceMapValues,
            declarativeRules: Array.from(rulesTemplates.values()),
            regexpRulesCount,
            errors,
        };
    }
}
