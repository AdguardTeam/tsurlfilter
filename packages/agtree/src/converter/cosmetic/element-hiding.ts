/**
 * @file Element hiding rule converter.
 */

import { CosmeticRuleSeparator, type ElementHidingRule } from '../../nodes';
import { CssTokenStream } from '../../parser-legacy/css/css-token-stream';
import { AdblockSyntax } from '../../utils/adblockers';
import { clone } from '../../utils/clone';
import { createNodeConversionResult, type NodeConversionResult } from '../base-interfaces/conversion-result';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { CssSelectorConverter } from '../css';

/**
 * Element hiding rule converter class.
 *
 * @todo Implement `convertToAbp`.
 */
export class ElementHidingRuleConverter extends RuleConverterBase {
    /**
     * Converts an element hiding rule to AdGuard format, if possible.
     *
     * @param rule Rule node to convert.
     *
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference.
     *
     * @throws If the rule is invalid or cannot be converted.
     */
    public static convertToAdg(rule: ElementHidingRule): NodeConversionResult<ElementHidingRule> {
        const separator = rule.separator.value;
        let convertedSeparator = separator;
        const stream = new CssTokenStream(rule.body.selectorList.value);
        const convertedSelectorList = CssSelectorConverter.convertToAdg(stream);

        // Change the separator if the rule contains ExtendedCSS elements,
        // but do not force non-extended CSS separator if the rule does not contain any ExtendedCSS selectors,
        // because sometimes we use it to force executing ExtendedCSS library.
        if (stream.hasAnySelectorExtendedCssNodeStrict()) {
            convertedSeparator = rule.exception
                ? CosmeticRuleSeparator.ExtendedElementHidingException
                : CosmeticRuleSeparator.ExtendedElementHiding;
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

    /**
     * Converts an element hiding rule to uBlock Origin format, if possible.
     *
     * Delegates selector conversion to {@link CssSelectorConverter.convertToUbo}
     * which handles `:contains()` → `:has-text()` renaming and argument quoting.
     *
     * @param rule Rule node to convert.
     *
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference.
     *
     * @throws If the rule is invalid or cannot be converted.
     */
    public static convertToUbo(rule: ElementHidingRule): NodeConversionResult<ElementHidingRule> {
        // Skip conversion if the rule is already in uBO format
        if (rule.syntax === AdblockSyntax.Ubo) {
            return createNodeConversionResult([rule], false);
        }

        const convertedSelectorList = CssSelectorConverter.convertToUbo(rule.body.selectorList.value);

        // Determine if separator needs adjustment.
        // For uBO, use ## / #@# (uBO auto-detects extended CSS from selector content).
        const targetSeparator = rule.exception
            ? CosmeticRuleSeparator.ElementHidingException
            : CosmeticRuleSeparator.ElementHiding;

        const separatorNeedsChange = rule.separator.value !== targetSeparator;

        // If no conversion needed, return as-is
        if (!convertedSelectorList.isConverted && !separatorNeedsChange) {
            return createNodeConversionResult([rule], false);
        }

        const ruleClone = clone(rule);
        ruleClone.syntax = AdblockSyntax.Ubo;

        if (convertedSelectorList.isConverted) {
            ruleClone.body.selectorList.value = convertedSelectorList.result;
        }

        ruleClone.separator.value = targetSeparator;

        return createNodeConversionResult([ruleClone], true);
    }
}
