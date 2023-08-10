/**
 * @file CSS injection rule converter
 */

import cloneDeep from 'clone-deep';
import { type SelectorList, fromPlainObject } from '@adguard/ecss-tree';

import { CosmeticRuleSeparator, type CssInjectionRule } from '../../parser/common';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { CssSelectorConverter } from '../css';
import { AdblockSyntax } from '../../utils/adblockers';
import { CssTree } from '../../utils/csstree';

/**
 * Rule converter class
 *
 * @todo Implement `convertToUbo` and `convertToAbp`
 */
export class CssInjectionRuleConverter extends RuleConverterBase {
    /**
     * Convert rule to AdGuard format
     *
     * @param rule Rule to convert, can be a string or an AST
     * @returns Array of converted rules ASTs
     * @throws If the rule is invalid or incompatible
     */
    public static convertToAdg(rule: CssInjectionRule): CssInjectionRule[] {
        // Clone the provided AST node to avoid side effects
        const ruleNode = cloneDeep(rule);

        // Change the separator if the rule contains ExtendedCSS selectors
        if (CssTree.hasAnySelectorExtendedCssNode(ruleNode.body.selectorList) || ruleNode.body.remove) {
            ruleNode.separator.value = ruleNode.exception
                ? CosmeticRuleSeparator.AdgExtendedCssInjectionException
                : CosmeticRuleSeparator.AdgExtendedCssInjection;
        } else {
            ruleNode.separator.value = ruleNode.exception
                ? CosmeticRuleSeparator.AdgCssInjectionException
                : CosmeticRuleSeparator.AdgCssInjection;
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
