/**
 * @file Scriptlet injection rule converter
 */

import cloneDeep from 'clone-deep';

import { CosmeticRuleSeparator, type ParameterList, type ScriptletInjectionRule } from '../../parser/common';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { AdgScriptletConverter } from './scriptlets/adg';
import { AdblockSyntax } from '../../utils/adblockers';

/**
 * Scriptlet injection rule converter class
 *
 * @todo Implement `convertToUbo` and `convertToAbp`
 */
export class ScriptletRuleConverter extends RuleConverterBase {
    /**
     * Converts a scriptlet injection rule to AdGuard format, if possible.
     *
     * @param rule Rule node to convert
     * @returns Array of converted rule nodes
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: ScriptletInjectionRule): ScriptletInjectionRule[] {
        // Clone the provided AST node to avoid side effects
        const ruleNode = cloneDeep(rule);
        const convertedScriptlets: ParameterList[] = [];

        for (const scriptlet of ruleNode.body.children) {
            if (ruleNode.syntax === AdblockSyntax.Abp) {
                convertedScriptlets.push(
                    AdgScriptletConverter.convertFromAbp(scriptlet),
                );
            } else if (ruleNode.syntax === AdblockSyntax.Ubo) {
                convertedScriptlets.push(
                    AdgScriptletConverter.convertFromUbo(scriptlet),
                );
            } else if (ruleNode.syntax === AdblockSyntax.Adg) {
                convertedScriptlets.push(scriptlet);
            }
        }

        ruleNode.separator.value = ruleNode.exception
            ? CosmeticRuleSeparator.AdgJsInjectionException
            : CosmeticRuleSeparator.AdgJsInjection;

        // ADG doesn't support multiple scriptlets in one rule, so we should split them
        return convertedScriptlets.map((scriptlet) => {
            return {
                ...ruleNode,
                syntax: AdblockSyntax.Adg,
                body: {
                    ...ruleNode.body,
                    children: [scriptlet],
                },
            };
        });
    }
}
