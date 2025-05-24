/**
 * @file CSS injection rule converter
 */

import { CosmeticRuleSeparator, type CssInjectionRule } from '../../nodes/index.js';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base.js';
import { CssSelectorConverter } from '../css/index.js';
import { AdblockSyntax } from '../../utils/adblockers.js';
import { clone } from '../../utils/clone.js';
import { type NodeConversionResult, createNodeConversionResult } from '../base-interfaces/conversion-result.js';
import { CssTokenStream } from '../../parser/css/css-token-stream.js';

/**
 * CSS injection rule converter class
 *
 * @todo Implement `convertToUbo` and `convertToAbp`
 */
export class CssInjectionRuleConverter extends RuleConverterBase {
    /**
     * Converts a CSS injection rule to AdGuard format, if possible.
     *
     * @param rule Rule node to convert
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: CssInjectionRule): NodeConversionResult<CssInjectionRule> {
        const separator = rule.separator.value;
        let convertedSeparator = separator;
        const stream = new CssTokenStream(rule.body.selectorList.value);
        const convertedSelectorList = CssSelectorConverter.convertToAdg(stream);

        // Change the separator if the rule contains ExtendedCSS elements,
        // but do not force non-extended CSS separator if the rule does not contain any ExtendedCSS selectors,
        // because sometimes we use it to force executing ExtendedCSS library.
        if (stream.hasAnySelectorExtendedCssNodeStrict() || rule.body.remove) {
            convertedSeparator = rule.exception
                ? CosmeticRuleSeparator.AdgExtendedCssInjectionException
                : CosmeticRuleSeparator.AdgExtendedCssInjection;
        } else if (rule.syntax !== AdblockSyntax.Adg) {
            // If the original rule syntax is not AdGuard, use the default separator
            // e.g. if the input rule is from uBO, we need to convert ## to #$#.
            convertedSeparator = rule.exception
                ? CosmeticRuleSeparator.AdgCssInjectionException
                : CosmeticRuleSeparator.AdgCssInjection;
        }

        // Check if the rule needs to be converted
        if (
            !(rule.syntax === AdblockSyntax.Common || rule.syntax === AdblockSyntax.Adg)
            || separator !== convertedSeparator
            || convertedSelectorList.isConverted
        ) {
            // TODO: Replace with custom clone method
            const ruleClone = clone(rule);

            ruleClone.syntax = AdblockSyntax.Adg;
            ruleClone.separator.value = convertedSeparator;
            ruleClone.body.selectorList.value = convertedSelectorList.result;

            return createNodeConversionResult([ruleClone], true);
        }

        // Otherwise, return the original rule
        return createNodeConversionResult([rule], false);
    }
}
