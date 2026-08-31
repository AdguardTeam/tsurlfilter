/**
 * @file Cosmetic rule converter.
 */

import { RuleConversionError } from '../../errors/rule-conversion-error';
import {
    type AnyCosmeticRule,
    type AnyRule,
    CosmeticRuleSeparator,
    CosmeticRuleType,
    type DomainList,
    type ModifierList,
    RuleCategory,
} from '../../nodes';
import { COMMA } from '../../utils';
import { clone } from '../../utils/clone';
import { SYNTAX_ABP, SYNTAX_ADG, SYNTAX_UBO } from '../../utils/syntax-flags';
import {
    type ConversionResult,
    createNodeConversionResult,
    type NodeConversionResult,
} from '../base-interfaces/conversion-result';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';

import { CssInjectionRuleConverter } from './css';
import { ElementHidingRuleConverter } from './element-hiding';
import { HeaderRemovalRuleConverter } from './header-removal';
import { HtmlRuleConverter } from './html';
import { convertPathInDomainToModifier } from './path-converter';
import { AdgCosmeticRuleModifierConverter } from './rule-modifiers/adg';
import { UboCosmeticRuleModifierConverter } from './rule-modifiers/ubo';
import { ScriptletRuleConverter } from './scriptlet';

/**
 * Cosmetic rule converter class (also known as "non-basic rule converter").
 *
 * @todo Implement `convertToUbo` and `convertToAbp`.
 */
export class CosmeticRuleConverter extends RuleConverterBase {
    /**
     * Converts a cosmetic rule to AdGuard syntax, if possible.
     *
     * @param rule Rule node to convert.
     *
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference.
     *
     * @throws If the rule is invalid or cannot be converted.
     */
    public static convertToAdg(rule: AnyCosmeticRule): NodeConversionResult<AnyRule> {
        let subconverterResult: NodeConversionResult<AnyRule>;

        // Convert cosmetic rule based on its type
        switch (rule.type) {
            case CosmeticRuleType.ElementHidingRule:
                subconverterResult = ElementHidingRuleConverter.convertToAdg(rule);
                break;

            case CosmeticRuleType.ScriptletInjectionRule:
                subconverterResult = ScriptletRuleConverter.convertToAdg(rule);
                break;

            case CosmeticRuleType.CssInjectionRule:
                subconverterResult = CssInjectionRuleConverter.convertToAdg(rule);
                break;

            case CosmeticRuleType.HtmlFilteringRule:
                // Handle special case: uBO response header filtering rule
                // TODO: Optimize double CSS tokenization here
                subconverterResult = HeaderRemovalRuleConverter.convertToAdg(rule);

                if (subconverterResult.isConverted) {
                    break;
                }

                subconverterResult = HtmlRuleConverter.convertToAdg(rule);
                break;

            // Note: Currently, only ADG supports JS injection rules, so we don't need to convert them
            case CosmeticRuleType.JsInjectionRule:
                subconverterResult = createNodeConversionResult([rule], false);
                break;

            default:
                throw new RuleConversionError('Unsupported cosmetic rule type');
        }

        let convertedModifiers: ConversionResult<ModifierList> | undefined;

        // Convert cosmetic rule modifiers, if any
        if (rule.modifiers) {
            if (rule.syntax & SYNTAX_UBO) {
                // uBO doesn't support this rule:
                // example.com##+js(set-constant.js, foo, bar):matches-path(/baz)
                if (rule.type === CosmeticRuleType.ScriptletInjectionRule) {
                    throw new RuleConversionError(
                        'uBO scriptlet injection rules don\'t support cosmetic rule modifiers',
                    );
                }

                convertedModifiers = AdgCosmeticRuleModifierConverter.convertFromUbo(rule.modifiers);
            } else if (rule.syntax & SYNTAX_ABP) {
                // TODO: Implement once ABP starts supporting cosmetic rule modifiers
                throw new RuleConversionError('ABP don\'t support cosmetic rule modifiers');
            }
        }

        // Track if any conversion happened
        const wasConverted = subconverterResult.isConverted
            || (convertedModifiers?.isConverted ?? false);

        if (wasConverted) {
            // Add modifier list to the subconverter result rules
            subconverterResult.result.forEach((subconverterRule) => {
                if (convertedModifiers && subconverterRule.category === RuleCategory.Cosmetic) {
                    // eslint-disable-next-line no-param-reassign
                    subconverterRule.modifiers = convertedModifiers.result;
                }
            });
        }

        // Apply path-in-domain conversion to all rules
        const rulesToProcess = wasConverted ? subconverterResult.result : [rule];
        const finalRules: AnyRule[] = [];
        let pathConversionHappened = false;

        for (const ruleToProcess of rulesToProcess) {
            if (ruleToProcess.category === RuleCategory.Cosmetic) {
                const pathConversionResult = convertPathInDomainToModifier(
                    ruleToProcess as AnyCosmeticRule,
                );

                if (pathConversionResult) {
                    finalRules.push(...pathConversionResult.result);
                    pathConversionHappened = true;
                } else {
                    finalRules.push(ruleToProcess);
                }
            } else {
                finalRules.push(ruleToProcess);
            }
        }

        // Return result with combined conversion status
        if (wasConverted || pathConversionHappened) {
            return createNodeConversionResult(finalRules, true);
        }

        return createNodeConversionResult([rule], false);
    }

    /**
     * Converts a cosmetic rule to uBlock Origin syntax, if possible.
     *
     * @param rule Rule node to convert.
     *
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference.
     *
     * @throws If the rule is invalid or cannot be converted.
     */
    public static convertToUbo(rule: AnyCosmeticRule): NodeConversionResult<AnyRule> {
        // Skip conversion if the rule is already exclusively in uBO format.
        // A bitwise check (`rule.syntax & SYNTAX_UBO`) is not enough here: rules
        // that are common to several products (e.g. SYNTAX_ALL) also have the uBO
        // bit set, yet may still need normalization when targeting uBO. Requiring
        // an exact match keeps the behavior aligned with the sub-converters, which
        // treat "already uBO" as the only no-op case.
        if (rule.syntax === SYNTAX_UBO) {
            return createNodeConversionResult([rule], false);
        }

        // TODO: Add support for other cosmetic rule types
        switch (rule.type) {
            case CosmeticRuleType.HtmlFilteringRule:
                return HtmlRuleConverter.convertToUbo(rule);
            case CosmeticRuleType.ElementHidingRule: {
                const elemHideResult = ElementHidingRuleConverter.convertToUbo(rule);

                // If no modifiers to convert, return the sub-converter result directly.
                // ElementHidingRuleConverter.convertToUbo() already handles
                // selector conversion and separator normalization.
                if (!rule.modifiers) {
                    return elemHideResult;
                }

                // For rules with modifiers, apply modifier conversion on top
                let convertedModifiers: ConversionResult<{
                    modifierList: ModifierList;
                    domains?: DomainList;
                }> | undefined;

                if (rule.syntax & SYNTAX_ABP) {
                    throw new RuleConversionError('ABP does not support cosmetic rule modifiers');
                } else if (rule.syntax & SYNTAX_ADG) {
                    convertedModifiers = UboCosmeticRuleModifierConverter.convertFromAdg(rule.modifiers);
                }

                const wasConverted = elemHideResult.isConverted || (convertedModifiers?.isConverted ?? false);

                // Use converted rule if available, otherwise clone original
                const result = elemHideResult.isConverted
                    ? elemHideResult.result[0]
                    : clone(rule);

                if (convertedModifiers?.isConverted) {
                    result.modifiers = convertedModifiers.result.modifierList;

                    if (convertedModifiers.result.domains) {
                        result.domains = convertedModifiers.result.domains;
                        result.domains.separator = COMMA;
                    }
                }

                // Separator normalization is already handled by
                // ElementHidingRuleConverter.convertToUbo() when elemHideResult.isConverted,
                // but we still need it for the clone(rule) path.
                if (!elemHideResult.isConverted) {
                    result.syntax = SYNTAX_UBO;
                    result.separator.value = rule.exception
                        ? CosmeticRuleSeparator.ElementHidingException
                        : CosmeticRuleSeparator.ElementHiding;
                }

                return createNodeConversionResult([result], wasConverted);
            }
            case CosmeticRuleType.ScriptletInjectionRule:
                return ScriptletRuleConverter.convertToUbo(rule);
            case CosmeticRuleType.JsInjectionRule:
                throw new RuleConversionError(
                    'uBO does not support JS injection rules',
                );
            default:
                break;
        }

        let convertedModifiers: ConversionResult<{
            modifierList: ModifierList;
            domains?: DomainList;
        }> | undefined;

        // Convert cosmetic rule modifiers, if any
        if (rule.modifiers) {
            if (rule.syntax & SYNTAX_ABP) {
                // TODO: Implement once ABP starts supporting cosmetic rule modifiers
                throw new RuleConversionError('ABP does not support cosmetic rule modifiers');
            } else if (rule.syntax & SYNTAX_ADG) {
                convertedModifiers = UboCosmeticRuleModifierConverter.convertFromAdg(rule.modifiers);
            }
        }

        const result = clone(rule);

        result.syntax = SYNTAX_UBO;

        if (convertedModifiers && convertedModifiers.isConverted) {
            result.modifiers = convertedModifiers.result.modifierList;

            if (convertedModifiers.result.domains) {
                result.domains = convertedModifiers.result.domains;
                result.domains.separator = COMMA;
            }
        }

        // Handle separator to uBO format
        let convertedSeparator = result.separator.value;

        convertedSeparator = rule.exception
            ? CosmeticRuleSeparator.ElementHidingException
            : CosmeticRuleSeparator.ElementHiding;

        result.separator.value = convertedSeparator;

        return createNodeConversionResult([result], true);
    }
}
