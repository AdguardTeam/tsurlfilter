/**
 * @file Cosmetic rule converter
 */

import {
    type AnyCosmeticRule,
    type AnyRule,
    CosmeticRuleType,
    type ModifierList,
    RuleCategory,
} from '../../parser/common';
import { AdblockSyntax } from '../../utils/adblockers';
import { HtmlRuleConverter } from './html';
import { ScriptletRuleConverter } from './scriptlet';
import { RuleConversionError } from '../../errors/rule-conversion-error';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { AdgCosmeticRuleModifierConverter } from './rule-modifiers/adg';
import { CssInjectionRuleConverter } from './css';
import { ElementHidingRuleConverter } from './element-hiding';
import { HeaderRemovalRuleConverter, UBO_RESPONSEHEADER_MARKER } from './header-removal';
import { CssTreeNodeType } from '../../utils/csstree-constants';
import {
    type NodeConversionResult,
    createNodeConversionResult,
    type ConversionResult,
} from '../base-interfaces/conversion-result';

/**
 * Cosmetic rule converter class (also known as "non-basic rule converter")
 *
 * @todo Implement `convertToUbo` and `convertToAbp`
 */
export class CosmeticRuleConverter extends RuleConverterBase {
    /**
     * Converts a cosmetic rule to AdGuard syntax, if possible.
     *
     * @param rule Rule node to convert
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws If the rule is invalid or cannot be converted
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
                if (
                    rule.body.body.type === CssTreeNodeType.Function
                    && rule.body.body.name === UBO_RESPONSEHEADER_MARKER
                ) {
                    subconverterResult = HeaderRemovalRuleConverter.convertToAdg(rule);
                } else {
                    subconverterResult = HtmlRuleConverter.convertToAdg(rule);
                }
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
            if (rule.syntax === AdblockSyntax.Ubo) {
                // uBO doesn't support this rule:
                // example.com##+js(set-constant.js, foo, bar):matches-path(/baz)
                if (rule.type === CosmeticRuleType.ScriptletInjectionRule) {
                    throw new RuleConversionError(
                        'uBO scriptlet injection rules don\'t support cosmetic rule modifiers',
                    );
                }

                convertedModifiers = AdgCosmeticRuleModifierConverter.convertFromUbo(rule.modifiers);
            } else if (rule.syntax === AdblockSyntax.Abp) {
                // TODO: Implement once ABP starts supporting cosmetic rule modifiers
                throw new RuleConversionError('ABP don\'t support cosmetic rule modifiers');
            }
        }

        if (
            (subconverterResult.result.length > 1 || subconverterResult.isConverted)
            || (convertedModifiers && convertedModifiers.isConverted)
        ) {
            // Add modifier list to the subconverter result rules
            subconverterResult.result.forEach((subconverterRule) => {
                if (convertedModifiers && subconverterRule.category === RuleCategory.Cosmetic) {
                    // eslint-disable-next-line no-param-reassign
                    subconverterRule.modifiers = convertedModifiers.result;
                }
            });

            return subconverterResult;
        }

        return createNodeConversionResult([rule], false);
    }
}
