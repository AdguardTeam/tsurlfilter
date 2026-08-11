/**
 * @file Scriptlet injection rule converter.
 */

import { cloneDomainListNode, cloneModifierListNode, cloneScriptletRuleNode } from '../../ast-utils/clone';
import {
    getScriptletName,
    setScriptletName,
    setScriptletQuoteType,
    transformAllScriptletArguments,
    transformNthScriptletArgument,
} from '../../ast-utils/scriptlets';
import { GenericPlatform, scriptletsCompatibilityTable } from '../../compatibility-tables';
import { type ScriptletDataSchema } from '../../compatibility-tables/schemas';
import { RuleConversionError } from '../../errors/rule-conversion-error';
import {
    CosmeticRuleSeparator,
    type DomainList,
    type ParameterList,
    type ScriptletInjectionRule,
} from '../../nodes';
import { DomainListParser } from '../../parser';
import { AdblockSyntax } from '../../utils/adblockers';
import {
    ADG_DOMAINS_MODIFIER,
    EMPTY,
    PIPE_MODIFIER_SEPARATOR,
    SPACE,
} from '../../utils/constants';
import { QuoteType, QuoteUtils } from '../../utils/quotes';
import { isNull, isUndefined } from '../../utils/type-guards';
import { createNodeConversionResult, type NodeConversionResult } from '../base-interfaces/conversion-result';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';

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

const UBO_JSON_PRUNE_FETCH_RESPONSE_NAME = 'json-prune-fetch-response.js';
const UBO_JSON_PRUNE_XHR_RESPONSE_NAME = 'json-prune-xhr-response.js';

const UBO_PRUNE_RESPONSE_PROPS_TO_MATCH_KEY = 'propsToMatch';
const UBO_PRUNE_RESPONSE_STACK_TO_MATCH_KEY = 'stackToMatch';

const ADG_PRUNE_FETCH_RESPONSE_NAME = UBO_JSON_PRUNE_FETCH_RESPONSE_NAME.slice(0, -UBO_SCRIPTLET_JS_SUFFIX_LENGTH);
const ADG_PRUNE_XHR_RESPONSE_NAME = UBO_JSON_PRUNE_XHR_RESPONSE_NAME.slice(0, -UBO_SCRIPTLET_JS_SUFFIX_LENGTH);

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
 * Scriptlet injection rule converter class.
 *
 * @todo Implement `convertToUbo` and `convertToAbp`.
 */
export class ScriptletRuleConverter extends RuleConverterBase {
    /**
     * Converts a scriptlet injection rule to AdGuard format, if possible.
     *
     * @param rule Rule node to convert.
     *
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference.
     *
     * @throws If the rule is invalid or cannot be converted.
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

                // Remap uBO prune-response scriptlet key/value args into ADG positional slots.
                // https://github.com/AdguardTeam/FiltersCompiler/issues/250
                if (scriptletData) {
                    ScriptletRuleConverter.remapUboPruneResponseArgs(scriptletClone, scriptletData);
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
     * @param rule Rule node to convert.
     *
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference.
     *
     * @throws If the rule is invalid or cannot be converted.
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

                case ADG_PRUNE_FETCH_RESPONSE_NAME:
                case ADG_PRUNE_XHR_RESPONSE_NAME:
                    ScriptletRuleConverter.remapAdgToUboPruneResponseArgs(scriptletClone);
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

    /**
     * Remaps uBO key/value args of `json-prune-fetch-response` and
     * `json-prune-xhr-response` into AdGuard positional argument slots.
     *
     * These uBO variants accept only two positional args (`propsToRemove`,
     * `obligatoryProps`); args 3+ are key/value pairs parsed by uBO's
     * `getExtraArgs` (even index = key, odd index = value). Recognized keys:
     * `propsToMatch`, `stackToMatch`. ADG's equivalents use positional
     * `propsToMatch` (arg 3) and `stack` (arg 4), so the pairs are remapped into
     * positional slots. Unknown keys are dropped, because uBO ignores keys it
     * does not read and they cannot be mapped to an ADG positional slot. When a
     * recognized key repeats, the last value wins.
     *
     * Besides remapping arguments, this method also sets the scriptlet node's
     * name to the AdGuard native name (the uBO canonical name without the
     * `.js` suffix). This overrides the `ubo-` prefix that `convertToAdg`
     * adds earlier in its main flow for these two scriptlets, so the final
     * output uses the native AdGuard name with positional argument semantics.
     *
     * @see https://github.com/AdguardTeam/FiltersCompiler/issues/250
     *
     * @param scriptletClone Cloned scriptlet node to remap in place.
     * @param scriptletData Compatibility data for the matched uBO scriptlet.
     */
    private static remapUboPruneResponseArgs(
        scriptletClone: ParameterList,
        scriptletData: ScriptletDataSchema,
    ): void {
        // Only the two prune-response scriptlets need key/value → positional remapping.
        if (
            scriptletData.name !== UBO_JSON_PRUNE_FETCH_RESPONSE_NAME
            && scriptletData.name !== UBO_JSON_PRUNE_XHR_RESPONSE_NAME
        ) {
            return;
        }

        const propsToRemove = scriptletClone.children[1]?.value ?? EMPTY;
        const obligatoryProps = scriptletClone.children[2]?.value ?? EMPTY;
        // Whether the source had an explicit 2nd positional arg (children[2]).
        const hadObligatoryProps = scriptletClone.children.length > 2;

        let propsToMatch = EMPTY;
        let stack = EMPTY;
        const unknownKeys: string[] = [];

        // Varargs start at index 3 (children[0] is the scriptlet name).
        for (let i = 3; i < scriptletClone.children.length; i += 2) {
            const key = scriptletClone.children[i]?.value ?? EMPTY;
            const val = scriptletClone.children[i + 1]?.value ?? EMPTY;

            if (key === UBO_PRUNE_RESPONSE_PROPS_TO_MATCH_KEY) {
                propsToMatch = val;
            } else if (key === UBO_PRUNE_RESPONSE_STACK_TO_MATCH_KEY) {
                stack = val;
            } else if (key !== EMPTY) {
                // Unknown keys are dropped: uBO ignores keys it does not read,
                // and they cannot be mapped to an ADG positional slot.
                unknownKeys.push(key);
            }
        }

        if (unknownKeys.length > 0) {
            // eslint-disable-next-line no-console
            console.warn(
                `[agtree] Dropped unknown extra args for ${scriptletData.name}: ${unknownKeys.join(', ')}`,
            );
        }

        // Translate to the ADG native name (uBO canonical name without the
        // `.js` suffix): the arguments are now in ADG positional semantics.
        const adgName = scriptletData.name.slice(0, -UBO_SCRIPTLET_JS_SUFFIX_LENGTH);
        setScriptletName(scriptletClone, adgName);

        // Rebuild children: name, propsToRemove, then the obligatoryProps,
        // propsToMatch and stack slots. `obligatoryProps` is emitted only when
        // it was present in the source or when a positional propsToMatch/stack
        // slot follows, so the output never gains a trailing empty arg the
        // source never had.
        // eslint-disable-next-line no-param-reassign
        scriptletClone.children = [
            scriptletClone.children[0],
            { type: 'Value', value: propsToRemove },
        ];

        if (hadObligatoryProps || propsToMatch !== EMPTY || stack !== EMPTY) {
            scriptletClone.children.push({ type: 'Value', value: obligatoryProps });
        }
        if (propsToMatch !== EMPTY || stack !== EMPTY) {
            scriptletClone.children.push({ type: 'Value', value: propsToMatch });
        }
        if (stack !== EMPTY) {
            scriptletClone.children.push({ type: 'Value', value: stack });
        }
    }

    /**
     * Inverse of {@link ScriptletRuleConverter.remapUboPruneResponseArgs}:
     * remaps AdGuard positional `propsToMatch`/`stack` args of
     * `json-prune-fetch-response` / `json-prune-xhr-response` back into uBO
     * key/value pairs (`propsToMatch`, `stackToMatch`).
     *
     * `children` layout (AdGuard, before this method): `[name, propsToRemove,
     * obligatoryProps, propsToMatch, stack]`. `propsToMatch` and `stack` are
     * optional; empty values are not re-emitted, so the output never has
     * trailing empty key/value pairs. ADG rules that already use the
     * `ubo-`-prefixed name keep key/value args and are not handled here (they
     * take the `ubo-` prefix branch in `convertToUbo`, not this `switch`).
     *
     * @param scriptletClone Cloned scriptlet node to remap in place.
     */
    private static remapAdgToUboPruneResponseArgs(scriptletClone: ParameterList): void {
        // Read the positional propsToMatch/stack before truncating children.
        const propsToMatchVal = scriptletClone.children[3]?.value;
        const stackVal = scriptletClone.children[4]?.value;

        // Keep the name and the two positional args; drop the positional
        // propsToMatch/stack slots — they are re-emitted as uBO key/value pairs.
        // eslint-disable-next-line no-param-reassign
        scriptletClone.children = scriptletClone.children.slice(
            0,
            Math.min(3, scriptletClone.children.length),
        );

        if (propsToMatchVal && propsToMatchVal !== EMPTY) {
            scriptletClone.children.push({ type: 'Value', value: UBO_PRUNE_RESPONSE_PROPS_TO_MATCH_KEY });
            scriptletClone.children.push({ type: 'Value', value: propsToMatchVal });
        }

        if (stackVal && stackVal !== EMPTY) {
            scriptletClone.children.push({ type: 'Value', value: UBO_PRUNE_RESPONSE_STACK_TO_MATCH_KEY });
            scriptletClone.children.push({ type: 'Value', value: stackVal });
        }
    }
}
