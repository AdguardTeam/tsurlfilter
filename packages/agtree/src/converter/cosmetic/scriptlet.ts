/**
 * @file Scriptlet injection rule converter
 */

import { CosmeticRuleSeparator, type ParameterList, type ScriptletInjectionRule } from '../../parser/common';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { AdblockSyntax } from '../../utils/adblockers';
import { QuoteType, QuoteUtils } from '../../utils/quotes';
import { EMPTY } from '../../utils/constants';
import { getScriptletName, setScriptletName, setScriptletQuoteType } from '../../ast-utils/scriptlets';
import { type NodeConversionResult, createNodeConversionResult } from '../base-interfaces/conversion-result';
import { cloneDomainListNode, cloneModifierListNode, cloneScriptletRuleNode } from '../../ast-utils/clone';

const ABP_SCRIPTLET_PREFIX = 'abp-';
const UBO_SCRIPTLET_PREFIX = 'ubo-';

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
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: ScriptletInjectionRule): NodeConversionResult<ScriptletInjectionRule> {
        // Ignore AdGuard rules
        if (rule.syntax === AdblockSyntax.Adg) {
            return createNodeConversionResult([rule], false);
        }

        const separator = rule.separator.value;
        let convertedSeparator = separator;

        convertedSeparator = rule.exception
            ? CosmeticRuleSeparator.AdgJsInjectionException
            : CosmeticRuleSeparator.AdgJsInjection;

        const convertedScriptlets: ParameterList[] = [];

        for (const scriptlet of rule.body.children) {
            // Clone the node to avoid any side effects
            const scriptletClone = cloneScriptletRuleNode(scriptlet);

            // Remove possible quotes just to make it easier to work with the scriptlet name
            const scriptletName = QuoteUtils.setStringQuoteType(getScriptletName(scriptletClone), QuoteType.None);

            // Add prefix if it's not already there
            let prefix: string;

            switch (rule.syntax) {
                case AdblockSyntax.Abp:
                    prefix = ABP_SCRIPTLET_PREFIX;
                    break;

                case AdblockSyntax.Ubo:
                    prefix = UBO_SCRIPTLET_PREFIX;
                    break;

                default:
                    prefix = EMPTY;
            }

            if (!scriptletName.startsWith(prefix)) {
                setScriptletName(scriptletClone, `${prefix}${scriptletName}`);
            }

            // ADG scriptlet parameters should be quoted, and single quoted are preferred
            setScriptletQuoteType(scriptletClone, QuoteType.Single);

            convertedScriptlets.push(scriptletClone);
        }

        return createNodeConversionResult(
            convertedScriptlets.map((scriptlet): ScriptletInjectionRule => {
                const res: ScriptletInjectionRule = {
                    category: rule.category,
                    type: rule.type,
                    syntax: AdblockSyntax.Adg,
                    exception: rule.exception,
                    domains: cloneDomainListNode(rule.domains),
                    separator: {
                        type: 'Value',
                        value: convertedSeparator,
                    },
                    body: {
                        type: rule.body.type,
                        children: [scriptlet],
                    },
                };

                if (rule.modifiers) {
                    res.modifiers = cloneModifierListNode(rule.modifiers);
                }

                return res;
            }),
            true,
        );
    }
}
