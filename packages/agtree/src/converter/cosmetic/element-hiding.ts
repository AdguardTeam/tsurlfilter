/**
 * @file Element hiding rule converter
 */

import { CosmeticRuleSeparator, type ElementHidingRule } from '../../parser/common';
import { CssTree } from '../../utils/csstree';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { CssSelectorConverter } from '../css';
import { AdblockSyntax } from '../../utils/adblockers';
import { clone } from '../../utils/clone';
import { type NodeConversionResult, createNodeConversionResult } from '../base-interfaces/conversion-result';

/**
 * Element hiding rule converter class
 *
 * @todo Implement `convertToUbo` and `convertToAbp`
 */
export class ElementHidingRuleConverter extends RuleConverterBase {
    /**
     * Converts an element hiding rule to AdGuard format, if possible.
     *
     * @param rule Rule node to convert
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: ElementHidingRule): NodeConversionResult<ElementHidingRule> {
        const separator = rule.separator.value;
        let convertedSeparator = separator;

        // Change the separator if the rule contains ExtendedCSS selectors
        if (CssTree.hasAnySelectorExtendedCssNode(rule.body.selectorList)) {
            convertedSeparator = rule.exception
                ? CosmeticRuleSeparator.ExtendedElementHidingException
                : CosmeticRuleSeparator.ExtendedElementHiding;
        } else {
            convertedSeparator = rule.exception
                ? CosmeticRuleSeparator.ElementHidingException
                : CosmeticRuleSeparator.ElementHiding;
        }

        const convertedSelectorList = CssSelectorConverter.convertToAdg(rule.body.selectorList);

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
            ruleClone.body.selectorList = convertedSelectorList.result;

            return createNodeConversionResult([ruleClone], true);
        }

        // Otherwise, return the original rule
        return createNodeConversionResult([rule], false);
    }
}
