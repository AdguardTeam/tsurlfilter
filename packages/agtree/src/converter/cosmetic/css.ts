/**
 * @file CSS injection rule converter
 */

import { CosmeticRuleSeparator, type CssInjectionRule } from '../../parser/common';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { CssSelectorConverter } from '../css';
import { AdblockSyntax } from '../../utils/adblockers';
import { CssTree } from '../../utils/csstree';
import { clone } from '../../utils/clone';
import { type NodeConversionResult, createNodeConversionResult } from '../base-interfaces/conversion-result';

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

        // Change the separator if the rule contains ExtendedCSS selectors
        if (CssTree.hasAnySelectorExtendedCssNode(rule.body.selectorList) || rule.body.remove) {
            convertedSeparator = rule.exception
                ? CosmeticRuleSeparator.AdgExtendedCssInjectionException
                : CosmeticRuleSeparator.AdgExtendedCssInjection;
        } else {
            convertedSeparator = rule.exception
                ? CosmeticRuleSeparator.AdgCssInjectionException
                : CosmeticRuleSeparator.AdgCssInjection;
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
