/**
 * @file CSS injection rule converter.
 */

import { CosmeticRuleSeparator, type CssInjectionRule, NodeType } from '../../nodes';
import { clone } from '../../utils/clone';
import { isUnknown, SYNTAX_ADG } from '../../utils/syntax-flags';
import { createNodeConversionResult, type NodeConversionResult } from '../base-interfaces/conversion-result';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { CssSelectorConverter } from '../css';

/**
 * CSS injection rule converter class.
 *
 * @todo Implement `convertToUbo` and `convertToAbp`.
 */
export class CssInjectionRuleConverter extends RuleConverterBase {
    /**
     * Converts a CSS injection rule to AdGuard format, if possible.
     *
     * @param rule Rule node to convert.
     *
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference.
     *
     * @throws If the rule is invalid or cannot be converted.
     */
    public static convertToAdg(rule: CssInjectionRule): NodeConversionResult<CssInjectionRule> {
        const separator = rule.separator.value;
        let convertedSeparator = separator;
        const convertedSelectorList = CssSelectorConverter.convertToAdg(rule.body.selectorList);

        // Change the separator if the rule contains ExtendedCSS elements,
        // but do not force non-extended CSS separator if the rule does not contain any ExtendedCSS selectors,
        // because sometimes we use it to force executing ExtendedCSS library.
        if (convertedSelectorList.hasExtendedCss || rule.body.remove) {
            convertedSeparator = rule.exception
                ? CosmeticRuleSeparator.AdgExtendedCssInjectionException
                : CosmeticRuleSeparator.AdgExtendedCssInjection;
        } else if (!(rule.syntax & SYNTAX_ADG)) {
            // If the original rule syntax is not AdGuard, use the default separator
            // e.g. if the input rule is from uBO, we need to convert ## to #$#.
            convertedSeparator = rule.exception
                ? CosmeticRuleSeparator.AdgCssInjectionException
                : CosmeticRuleSeparator.AdgCssInjection;
        }

        // Check if the rule needs to be converted
        if (
            !(isUnknown(rule.syntax) || rule.syntax & SYNTAX_ADG)
            || separator !== convertedSeparator
            || convertedSelectorList.isConverted
        ) {
            // TODO: Replace with custom clone method
            const ruleClone = clone(rule);

            ruleClone.syntax = SYNTAX_ADG;
            ruleClone.separator.value = convertedSeparator;
            // After conversion the selector text has changed, so store as Raw
            ruleClone.body.selectorList = {
                type: NodeType.Raw,
                value: convertedSelectorList.result,
            };

            return createNodeConversionResult([ruleClone], true);
        }

        // Otherwise, return the original rule
        return createNodeConversionResult([rule], false);
    }
}
