import { NetworkRule } from '../../network-rule';
import { IndexedRule } from '../../rule';
import { ConversionError } from '../errors/conversion-errors';
import { DeclarativeRule } from '../declarative-rule';
import { Source } from '../source-map';
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

            delete template.id;
            delete template.action.requestHeaders;
            delete template.action.responseHeaders;

            return JSON.stringify(template);
        };

        const findRulePairId = (rule: DeclarativeRule): number | null => {
            const template = getRuleTemplate(rule);
            const ruleToJoin = rulesTemplates.get(template);

            if (!ruleToJoin) {
                return null;
            }

            // If found rule-sibling to join
            const { responseHeaders, requestHeaders } = rule.action;
            // Then combine remove headers
            if (responseHeaders) {
                if (ruleToJoin.action.responseHeaders) {
                    ruleToJoin.action.responseHeaders.push(...responseHeaders);
                } else {
                    ruleToJoin.action.responseHeaders = responseHeaders;
                }
            }
            if (requestHeaders) {
                if (ruleToJoin.action.requestHeaders) {
                    ruleToJoin.action.requestHeaders.push(...requestHeaders);
                } else {
                    ruleToJoin.action.requestHeaders = requestHeaders;
                }
            }

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
                const err = RemoveHeaderRulesConverter.catchErrorDuringConversion(rule, index, id, e);
                errors.push(err);
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
