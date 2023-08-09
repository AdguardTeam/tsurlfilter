/**
 * @file Element hiding rule converter
 */

import cloneDeep from 'clone-deep';
import { SelectorList, fromPlainObject } from '@adguard/ecss-tree';
import { CosmeticRuleSeparator, ElementHidingRule } from '../../parser/common';
import { CssTree } from '../../utils/csstree';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { CssSelectorConverter } from '../css';
import { AdblockSyntax } from '../../utils/adblockers';

/**
 * Rule converter class
 *
 * @todo Implement `convertToUbo` and `convertToAbp`
 */
export class ElementHidingRuleConverter extends RuleConverterBase {
    /**
     * Converts rule to AdGuard format
     *
     * @param rule Rule to convert, can be a string or an AST
     * @returns Array of converted rules ASTs
     * @throws If the rule is invalid or incompatible
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
