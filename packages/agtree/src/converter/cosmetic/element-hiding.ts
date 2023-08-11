/**
 * @file Element hiding rule converter
 */

import cloneDeep from 'clone-deep';
import { type SelectorList, fromPlainObject } from '@adguard/ecss-tree';

import { CosmeticRuleSeparator, type ElementHidingRule } from '../../parser/common';
import { CssTree } from '../../utils/csstree';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { CssSelectorConverter } from '../css';
import { AdblockSyntax } from '../../utils/adblockers';

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
     * @returns Array of converted rule nodes
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: ElementHidingRule): ElementHidingRule[] {
        // Clone the provided AST node to avoid side effects
        const ruleNode = cloneDeep(rule);

        // Change the separator if the rule contains ExtendedCSS selectors
        if (CssTree.hasAnySelectorExtendedCssNode(ruleNode.body.selectorList)) {
            ruleNode.separator.value = ruleNode.exception
                ? CosmeticRuleSeparator.ExtendedElementHidingException
                : CosmeticRuleSeparator.ExtendedElementHiding;
        } else {
            ruleNode.separator.value = ruleNode.exception
                ? CosmeticRuleSeparator.ElementHidingException
                : CosmeticRuleSeparator.ElementHiding;
        }

        // Convert CSS selector list
        Object.assign(
            ruleNode.body.selectorList,
            CssSelectorConverter.convertToAdg(
                fromPlainObject(ruleNode.body.selectorList) as SelectorList,
            ),
        );

        ruleNode.syntax = AdblockSyntax.Adg;

        return [ruleNode];
    }
}
