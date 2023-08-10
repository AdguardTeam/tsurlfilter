/**
 * @file Cosmetic rule converter
 */

import cloneDeep from 'clone-deep';

import { type AnyCosmeticRule, type AnyRule, CosmeticRuleType } from '../../parser/common';
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
     * @returns Array of converted rule nodes
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: AnyCosmeticRule): AnyRule[] {
        // Clone the provided AST node to avoid side effects
        const ruleNode = cloneDeep(rule);

        // Convert cosmetic rule modifiers
        if (ruleNode.modifiers) {
            if (ruleNode.syntax === AdblockSyntax.Ubo) {
                // uBO doesn't support this rule:
                // example.com##+js(set-constant.js, foo, bar):matches-path(/baz)
                if (ruleNode.type === CosmeticRuleType.ScriptletInjectionRule) {
                    throw new RuleConversionError(
                        'uBO scriptlet injection rules don\'t support cosmetic rule modifiers',
                    );
                }

                ruleNode.modifiers = AdgCosmeticRuleModifierConverter.convertFromUbo(ruleNode.modifiers);
            } else if (ruleNode.syntax === AdblockSyntax.Abp) {
                // TODO: Implement once ABP starts supporting cosmetic rule modifiers
                throw new RuleConversionError('ABP don\'t support cosmetic rule modifiers');
            }
        }

        // Convert cosmetic rule based on its type
        switch (ruleNode.type) {
            case CosmeticRuleType.ElementHidingRule:
                return ElementHidingRuleConverter.convertToAdg(ruleNode);

            case CosmeticRuleType.ScriptletInjectionRule:
                return ScriptletRuleConverter.convertToAdg(ruleNode);

            case CosmeticRuleType.CssInjectionRule:
                return CssInjectionRuleConverter.convertToAdg(ruleNode);

            case CosmeticRuleType.HtmlFilteringRule:
                // Handle special case: uBO response header filtering rule
                if (
                    ruleNode.body.body.type === CssTreeNodeType.Function
                    && ruleNode.body.body.name === UBO_RESPONSEHEADER_MARKER
                ) {
                    return HeaderRemovalRuleConverter.convertToAdg(ruleNode);
                }

                return HtmlRuleConverter.convertToAdg(ruleNode);

            // Note: Currently, only ADG supports JS injection rules
            case CosmeticRuleType.JsInjectionRule:
                return [ruleNode];

            default:
                throw new RuleConversionError('Unsupported cosmetic rule type');
        }
    }
}
