/**
 * @file Network rule modifier list converter.
 */

import scriptlets from '@adguard/scriptlets';

import { type Modifier, type ModifierList } from '../../parser/common';
import { SEMICOLON, SPACE } from '../../utils/constants';
import { createModifierNode } from '../../ast-utils/modifiers';
import { ConverterBase } from '../base-interfaces/converter-base';
import { RuleConversionError } from '../../errors/rule-conversion-error';
import { MultiValueMap } from '../../utils/multi-value-map';
import { createConversionResult, type ConversionResult } from '../base-interfaces/conversion-result';
import { cloneModifierListNode } from '../../ast-utils/clone';

// Since scriptlets library doesn't have ESM exports, we should import
// the whole module and then extract the required functions from it here.
// Otherwise importing AGTree will cause an error in ESM environment,
// because scriptlets library doesn't support named exports.
const { redirects } = scriptlets;

/**
 * Modifier conversion interface.
 */
interface ModifierConversion {
    /**
     * Sets the new modifier name.
     *
     * @param actual Actual modifier name
     * @returns New modifier name
     */
    name: (actual: string) => string;

    /**
     * Sets the new modifier exception value. If you don't specify this function,
     * the modifier exception value will be copied from the original modifier.
     *
     * @param actual Actual modifier exception value
     * @returns `true` if the modifier should be negated, `false` otherwise
     */
    exception?: (actual: boolean) => boolean;

    /**
     * Sets the new modifier value. If you don't specify this function,
     * the modifier value will be copied from the original modifier.
     *
     * @param actual Actual modifier value
     * @returns Converted modifier value or `undefined` if the modifier
     * value should be removed
     */
    value?: (actual: string | undefined) => string | undefined;
}

/**
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#csp-modifier}
 */
const CSP_MODIFIER = 'csp';
const CSP_SEPARATOR = SEMICOLON + SPACE;

/**
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#csp-modifier}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy}
 */
const COMMON_CSP_PARAMS = '\'self\' \'unsafe-eval\' http: https: data: blob: mediastream: filesystem:';

/**
 * @see {@link https://help.adblockplus.org/hc/en-us/articles/360062733293#rewrite}
 */
const ABP_REWRITE_MODIFIER = 'rewrite';

/**
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#redirect-modifier}
 */
const REDIRECT_MODIFIER = 'redirect';

/**
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#redirect-rule-modifier}
 */
const REDIRECT_RULE_MODIFIER = 'redirect-rule';

/**
 * Redirect-related modifiers.
 */
const REDIRECT_MODIFIERS = new Set([
    ABP_REWRITE_MODIFIER,
    REDIRECT_MODIFIER,
    REDIRECT_RULE_MODIFIER,
]);

/**
 * Conversion map for ADG network rule modifiers.
 */
const ADG_CONVERSION_MAP = new Map<string, ModifierConversion[]>([
    ['1p', [{ name: () => 'third-party', exception: (actual) => !actual }]],
    ['3p', [{ name: () => 'third-party' }]],
    ['css', [{ name: () => 'stylesheet' }]],
    ['doc', [{ name: () => 'document' }]],
    ['ehide', [{ name: () => 'elemhide' }]],
    ['empty', [{ name: () => 'redirect', value: () => 'nooptext' }]],
    ['first-party', [{ name: () => 'third-party', exception: (actual) => !actual }]],
    ['frame', [{ name: () => 'subdocument' }]],
    ['ghide', [{ name: () => 'generichide' }]],
    ['inline-font', [{ name: () => CSP_MODIFIER, value: () => `font-src ${COMMON_CSP_PARAMS}` }]],
    ['inline-script', [{ name: () => CSP_MODIFIER, value: () => `script-src ${COMMON_CSP_PARAMS}` }]],
    ['mp4', [{ name: () => 'redirect', value: () => 'noopmp4-1s' }, { name: () => 'media', value: () => undefined }]],
    ['queryprune', [{ name: () => 'removeparam' }]],
    ['shide', [{ name: () => 'specifichide' }]],
    ['xhr', [{ name: () => 'xmlhttprequest' }]],
]);

/**
 * Helper class for converting network rule modifier lists.
 *
 * @todo Implement `convertToUbo` and `convertToAbp`
 */
export class NetworkRuleModifierListConverter extends ConverterBase {
    /**
     * Converts a network rule modifier list to AdGuard format, if possible.
     *
     * @param modifierList Network rule modifier list node to convert
     * @returns An object which follows the {@link ConversionResult} interface. Its `result` property contains
     * the converted node, and its `isConverted` flag indicates whether the original node was converted.
     * If the node was not converted, the result will contain the original node with the same object reference
     * @throws If the conversion is not possible
     */
    public static convertToAdg(modifierList: ModifierList): ConversionResult<ModifierList> {
        const conversionMap = new MultiValueMap<number, Modifier>();

        // Special case: $csp modifier
        let cspCount = 0;

        modifierList.children.forEach((modifierNode, index) => {
            const modifierConversions = ADG_CONVERSION_MAP.get(modifierNode.modifier.value);

            if (modifierConversions) {
                for (const modifierConversion of modifierConversions) {
                    const name = modifierConversion.name(modifierNode.modifier.value);

                    const exception = modifierConversion.exception
                        // If the exception value is undefined in the original modifier, it
                        // means that the modifier isn't negated
                        ? modifierConversion.exception(modifierNode.exception || false)
                        : modifierNode.exception;

                    const value = modifierConversion.value
                        ? modifierConversion.value(modifierNode.value?.value)
                        : modifierNode.value?.value;

                    // Check if the name or the value is different from the original modifier
                    // If so, add the converted modifier to the list
                    if (name !== modifierNode.modifier.value || value !== modifierNode.value?.value) {
                        conversionMap.add(index, createModifierNode(name, value, exception));
                    }

                    // Special case: $csp modifier
                    if (name === CSP_MODIFIER) {
                        cspCount += 1;
                    }
                }

                return;
            }

            // Handle special case: resource redirection modifiers
            if (REDIRECT_MODIFIERS.has(modifierNode.modifier.value)) {
                // Redirect modifiers can't be negated
                if (modifierNode.exception === true) {
                    throw new RuleConversionError(
                        `Modifier '${modifierNode.modifier.value}' cannot be negated`,
                    );
                }

                // Convert the redirect resource name to ADG format
                const redirectResource = modifierNode.value?.value;

                if (!redirectResource) {
                    throw new RuleConversionError(
                        `No redirect resource specified for '${modifierNode.modifier.value}' modifier`,
                    );
                }

                // Leave $redirect and $redirect-rule modifiers as is, but convert $rewrite to $redirect
                const modifierName = modifierNode.modifier.value === ABP_REWRITE_MODIFIER
                    ? REDIRECT_MODIFIER
                    : modifierNode.modifier.value;

                // Try to convert the redirect resource name to ADG format
                // This function returns undefined if the resource name is unknown
                const convertedRedirectResource = redirects.convertRedirectNameToAdg(redirectResource);

                // Check if the modifier name or the redirect resource name is different from the original modifier
                // If so, add the converted modifier to the list
                if (
                    modifierName !== modifierNode.modifier.value
                    || (convertedRedirectResource !== undefined && convertedRedirectResource !== redirectResource)
                ) {
                    conversionMap.add(
                        index,
                        createModifierNode(
                            modifierName,
                            // If the redirect resource name is unknown, fall back to the original one
                            // Later, the validator will throw an error if the resource name is invalid
                            convertedRedirectResource || redirectResource,
                            modifierNode.exception,
                        ),
                    );
                }
            }
        });

        // Prepare the result if there are any converted modifiers or $csp modifiers
        if (conversionMap.size || cspCount) {
            const modifierListClone = cloneModifierListNode(modifierList);

            // Replace the original modifiers with the converted ones
            // One modifier may be replaced with multiple modifiers, so we need to flatten the array
            modifierListClone.children = modifierListClone.children.map((modifierNode, index) => {
                const conversionRecord = conversionMap.get(index);

                if (conversionRecord) {
                    return conversionRecord;
                }

                return modifierNode;
            }).flat();

            // Special case: $csp modifier: merge multiple $csp modifiers into one
            // and put it at the end of the modifier list
            if (cspCount) {
                const cspValues: string[] = [];

                modifierListClone.children = modifierListClone.children.filter((modifierNode) => {
                    if (modifierNode.modifier.value === CSP_MODIFIER) {
                        if (!modifierNode.value?.value) {
                            throw new RuleConversionError(
                                '$csp modifier value is missing',
                            );
                        }

                        cspValues.push(modifierNode.value?.value);

                        return false;
                    }

                    return true;
                });

                modifierListClone.children.push(
                    createModifierNode(CSP_MODIFIER, cspValues.join(CSP_SEPARATOR)),
                );
            }

            // Before returning the result, remove duplicated modifiers
            modifierListClone.children = modifierListClone.children.filter(
                (modifierNode, index, self) => self.findIndex(
                    (m) => m.modifier.value === modifierNode.modifier.value
                        && m.exception === modifierNode.exception
                        && m.value?.value === modifierNode.value?.value,
                ) === index,
            );

            return createConversionResult(modifierListClone, true);
        }

        return createConversionResult(modifierList, false);
    }
}
