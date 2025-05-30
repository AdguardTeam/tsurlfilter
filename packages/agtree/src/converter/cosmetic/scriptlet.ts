/**
 * @file Scriptlet injection rule converter
 */

import {
    CosmeticRuleSeparator,
    type DomainList,
    type ParameterList,
    type ScriptletInjectionRule,
} from '../../nodes';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { AdblockSyntax } from '../../utils/adblockers';
import { QuoteType, QuoteUtils } from '../../utils/quotes';
import {
    ADG_DOMAINS_MODIFIER,
    EMPTY,
    PIPE_MODIFIER_SEPARATOR,
    SPACE,
} from '../../utils/constants';
import {
    getScriptletName,
    setScriptletName,
    setScriptletQuoteType,
    transformAllScriptletArguments,
    transformNthScriptletArgument,
} from '../../ast-utils/scriptlets';
import { RuleConversionError } from '../../errors/rule-conversion-error';
import { type NodeConversionResult, createNodeConversionResult } from '../base-interfaces/conversion-result';
import { cloneDomainListNode, cloneModifierListNode, cloneScriptletRuleNode } from '../../ast-utils/clone';
import { GenericPlatform, scriptletsCompatibilityTable } from '../../compatibility-tables';
import { isNull, isUndefined } from '../../utils/type-guards';
import { DomainListParser } from '../../parser';

const ABP_SCRIPTLET_PREFIX = 'abp-';
const UBO_SCRIPTLET_PREFIX = 'ubo-';

const UBO_SCRIPTLET_PREFIX_LENGTH = UBO_SCRIPTLET_PREFIX.length;

const UBO_SCRIPTLET_JS_SUFFIX = '.js';
const UBO_SCRIPTLET_JS_SUFFIX_LENGTH = UBO_SCRIPTLET_JS_SUFFIX.length;

const COMMA_SEPARATOR = ',';

const ADG_SET_CONSTANT_NAME = 'set-constant';
const ADG_SET_CONSTANT_EMPTY_STRING = '';
const ADG_SET_CONSTANT_EMPTY_ARRAY = 'emptyArr';
const ADG_SET_CONSTANT_EMPTY_OBJECT = 'emptyObj';
const UBO_SET_CONSTANT_EMPTY_STRING = '\'\'';
const UBO_SET_CONSTANT_EMPTY_ARRAY = '[]';
const UBO_SET_CONSTANT_EMPTY_OBJECT = '{}';

const ADG_PREVENT_FETCH_NAME = 'prevent-fetch';
const ADG_PREVENT_FETCH_EMPTY_STRING = '';
const ADG_PREVENT_FETCH_WILDCARD = '*';
const UBO_NO_FETCH_IF_WILDCARD = '/^/';

const UBO_REMOVE_CLASS_NAME = 'remove-class.js';
const UBO_REMOVE_ATTR_NAME = 'remove-attr.js';

const setConstantAdgToUboMap: Record<string, string> = {
    [ADG_SET_CONSTANT_EMPTY_STRING]: UBO_SET_CONSTANT_EMPTY_STRING,
    [ADG_SET_CONSTANT_EMPTY_ARRAY]: UBO_SET_CONSTANT_EMPTY_ARRAY,
    [ADG_SET_CONSTANT_EMPTY_OBJECT]: UBO_SET_CONSTANT_EMPTY_OBJECT,
};

const REMOVE_ATTR_CLASS_APPLYING = new Set<string>([
    'asap',
    'stay',
    'complete',
]);

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

            // In uBO / ABP syntax, if a parameter contains the separator character, it should be escaped,
            // but during the conversion, we need to unescape them, because AdGuard syntax uses quotes to
            // distinguish between parameters.
            let charToUnescape: string | undefined;

            switch (rule.syntax) {
                case AdblockSyntax.Abp:
                    prefix = ABP_SCRIPTLET_PREFIX;
                    charToUnescape = SPACE;
                    break;

                case AdblockSyntax.Ubo:
                    prefix = UBO_SCRIPTLET_PREFIX;
                    charToUnescape = COMMA_SEPARATOR;
                    break;

                default:
                    prefix = EMPTY;
            }

            if (!scriptletName.startsWith(prefix)) {
                setScriptletName(scriptletClone, `${prefix}${scriptletName}`);
            }

            if (!isUndefined(charToUnescape)) {
                transformAllScriptletArguments(scriptletClone, (value) => {
                    if (!isNull(value)) {
                        return QuoteUtils.unescapeSingleEscapedOccurrences(value, charToUnescape);
                    }

                    return value;
                });
            }

            if (rule.syntax === AdblockSyntax.Ubo) {
                const scriptletData = scriptletsCompatibilityTable.getFirst(
                    scriptletName,
                    GenericPlatform.UboAny,
                );

                // Some scriptlets have special values that need to be converted
                if (
                    scriptletData
                    && (
                        scriptletData.name === UBO_REMOVE_CLASS_NAME
                        || scriptletData.name === UBO_REMOVE_ATTR_NAME
                    )
                    && scriptletClone.children.length > 2
                ) {
                    const selectors: string[] = [];

                    let applying: string | null = null;
                    let lastArg = scriptletClone.children.pop();

                    // The very last argument might be the 'applying' parameter
                    if (lastArg) {
                        if (REMOVE_ATTR_CLASS_APPLYING.has(lastArg.value)) {
                            applying = lastArg.value;
                        } else {
                            selectors.push(lastArg.value);
                        }
                    }

                    while (scriptletClone.children.length > 2) {
                        lastArg = scriptletClone.children.pop();

                        if (lastArg) {
                            selectors.push(lastArg.value.trim());
                        }
                    }

                    // Set last arg to be the combined selectors (in reverse order, because we popped them)
                    if (selectors.length > 0) {
                        scriptletClone.children.push({
                            type: 'Value',
                            value: selectors.reverse().join(', '),
                        });
                    }

                    // Push back the 'applying' parameter if it was found previously
                    if (!isNull(applying)) {
                        // If we don't have any selectors,
                        // we need to add an empty parameter before the 'applying' one
                        if (selectors.length === 0) {
                            scriptletClone.children.push({
                                type: 'Value',
                                value: EMPTY,
                            });
                        }

                        scriptletClone.children.push({
                            type: 'Value',
                            value: applying,
                        });
                    }
                }
            }

            // ADG scriptlet parameters should be quoted, and single quoted are preferred
            setScriptletQuoteType(scriptletClone, QuoteType.Single);

            convertedScriptlets.push(scriptletClone);
        }

        if (rule.body.children.length === 0) {
            const convertedScriptletNode: ScriptletInjectionRule = {
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
                    children: [],
                },
            };
            if (rule.modifiers) {
                convertedScriptletNode.modifiers = cloneModifierListNode(rule.modifiers);
            }

            return createNodeConversionResult([convertedScriptletNode], true);
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

    /**
     * Converts a scriptlet injection rule to uBlock format, if possible.
     *
     * @param rule Rule node to convert
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToUbo(rule: ScriptletInjectionRule): NodeConversionResult<ScriptletInjectionRule> {
        // Ignore uBlock rules
        if (rule.syntax === AdblockSyntax.Ubo) {
            return createNodeConversionResult([rule], false);
        }

        let ruleDomainsList: DomainList | undefined = cloneDomainListNode(rule.domains);

        if (rule.syntax === AdblockSyntax.Adg && rule.modifiers?.children.length) {
            const { modifiers } = rule;

            // Validate modifiers structure
            if (!modifiers || !modifiers.children || modifiers.children.length === 0) {
                throw new RuleConversionError('Invalid modifiers in AdGuard rule.');
            }

            // Check for single domain modifier
            const [domainModifier] = modifiers.children;
            const hasSingleDomainModifier = (
                modifiers.children.length === 1
                && domainModifier.name?.value === ADG_DOMAINS_MODIFIER
                && domainModifier.value?.value
            );

            if (!hasSingleDomainModifier) {
                throw new RuleConversionError(
                    'uBlock Origin scriptlet injection rules do not support cosmetic rule modifiers.',
                );
            }

            // Validate domain modifier
            if (!domainModifier.value?.value) {
                throw new RuleConversionError('Invalid domain modifier in AdGuard rule.');
            }

            // Parse domain list
            const parsedDomainList = DomainListParser.parse(
                domainModifier.value.value,
                {},
                domainModifier.start,
                PIPE_MODIFIER_SEPARATOR,
            );

            // Merge domain lists
            if (ruleDomainsList) {
                ruleDomainsList.children.push(...parsedDomainList.children);
            } else {
                ruleDomainsList = parsedDomainList;
            }
        }

        const separator = rule.separator.value;
        let convertedSeparator = separator;

        convertedSeparator = rule.exception
            ? CosmeticRuleSeparator.ElementHidingException
            : CosmeticRuleSeparator.ElementHiding;

        const convertedScriptlets: ParameterList[] = [];

        for (const scriptlet of rule.body.children) {
            // Clone the node to avoid any side effects
            const scriptletClone = cloneScriptletRuleNode(scriptlet);

            // Remove possible quotes just to make it easier to work with the scriptlet name
            const scriptletName = QuoteUtils.setStringQuoteType(getScriptletName(scriptletClone), QuoteType.None);

            let uboScriptletName: string;

            if (rule.syntax === AdblockSyntax.Adg && scriptletName.startsWith(UBO_SCRIPTLET_PREFIX)) {
                // Special case: AdGuard syntax 'preserves' the original scriptlet name,
                // so we need to convert it back by removing the uBO prefix
                uboScriptletName = scriptletName.slice(UBO_SCRIPTLET_PREFIX_LENGTH);
            } else {
                // Otherwise, try to find the corresponding uBO scriptlet name, or use the original one if not found
                const uboScriptlet = scriptletsCompatibilityTable.getFirst(scriptletName, GenericPlatform.UboAny);
                if (!uboScriptlet) {
                    throw new RuleConversionError(`Scriptlet "${scriptletName}" is not supported in uBlock Origin.`);
                }
                uboScriptletName = uboScriptlet.name;
            }

            // Remove the '.js' suffix if it's there - its presence is not mandatory
            if (uboScriptletName.endsWith(UBO_SCRIPTLET_JS_SUFFIX)) {
                uboScriptletName = uboScriptletName.slice(0, -UBO_SCRIPTLET_JS_SUFFIX_LENGTH);
            }

            setScriptletName(scriptletClone, uboScriptletName);
            setScriptletQuoteType(scriptletClone, QuoteType.None);

            // Escape unescaped commas in parameters, because uBlock Origin uses them as separators.
            // For example, the following AdGuard rule:
            //
            // example.com#%#//scriptlet('spoof-css', '.adsbygoogle, #ads', 'visibility', 'visible')
            //
            //      ↓↓ should be converted to ↓↓
            //
            // example.com##+js(spoof-css.js, .adsbygoogle\, #ads, visibility, visible)
            //                  ------------  -------------------  ----------  -------
            //                    arg 0              arg 1           arg 2      arg 3
            //
            // and we need to escape the comma in the second argument to prevent it from being treated
            // as two separate arguments.
            transformAllScriptletArguments(scriptletClone, (value) => {
                if (!isNull(value)) {
                    return QuoteUtils.escapeUnescapedOccurrences(value, COMMA_SEPARATOR);
                }

                return value;
            });

            // Unescape spaces in parameters, because uBlock Origin doesn't treat them as separators.
            if (rule.syntax === AdblockSyntax.Abp) {
                transformAllScriptletArguments(scriptletClone, (value) => {
                    if (!isNull(value)) {
                        return QuoteUtils.unescapeSingleEscapedOccurrences(value, SPACE);
                    }

                    return value;
                });
            }

            // Some scriptlets have special values that need to be converted
            switch (scriptletName) {
                case ADG_SET_CONSTANT_NAME:
                    transformNthScriptletArgument(scriptletClone, 2, (value) => {
                        if (!isNull(value)) {
                            return setConstantAdgToUboMap[value] ?? value;
                        }

                        return value;
                    });
                    break;

                case ADG_PREVENT_FETCH_NAME:
                    transformNthScriptletArgument(scriptletClone, 1, (value) => {
                        if (value === ADG_PREVENT_FETCH_EMPTY_STRING || value === ADG_PREVENT_FETCH_WILDCARD) {
                            return UBO_NO_FETCH_IF_WILDCARD;
                        }

                        return value;
                    });
                    break;

                default:
            }

            convertedScriptlets.push(scriptletClone);
        }

        // TODO: Refactor redundant code
        if (rule.body.children.length === 0) {
            const convertedScriptletNode: ScriptletInjectionRule = {
                category: rule.category,
                type: rule.type,
                syntax: AdblockSyntax.Ubo,
                exception: rule.exception,
                domains: cloneDomainListNode(rule.domains),
                separator: {
                    type: 'Value',
                    value: convertedSeparator,
                },
                body: {
                    type: rule.body.type,
                    children: [],
                },
            };
            if (rule.modifiers) {
                convertedScriptletNode.modifiers = cloneModifierListNode(rule.modifiers);
            }

            return createNodeConversionResult([convertedScriptletNode], true);
        }

        return createNodeConversionResult(
            convertedScriptlets.map((scriptlet): ScriptletInjectionRule => {
                const res: ScriptletInjectionRule = {
                    category: rule.category,
                    type: rule.type,
                    syntax: AdblockSyntax.Ubo,
                    exception: rule.exception,
                    domains: ruleDomainsList,
                    separator: {
                        type: 'Value',
                        value: convertedSeparator,
                    },
                    body: {
                        type: rule.body.type,
                        children: [scriptlet],
                    },
                };

                return res;
            }),
            true,
        );
    }
}
