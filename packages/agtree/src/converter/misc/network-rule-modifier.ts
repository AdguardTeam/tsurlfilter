/**
 * @file Network rule modifier list converter.
 */

import cloneDeep from 'clone-deep';
import scriptlets from '@adguard/scriptlets';

import { type ModifierList } from '../../parser/common';
import { SEMICOLON, SPACE } from '../../utils/constants';
import { createModifierListNode, createModifierNode } from '../../ast-utils/modifiers';
import { ConverterBase } from '../base-interfaces/converter-base';
import { RuleConversionError } from '../../errors/rule-conversion-error';

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
     * @returns Converted modifier list node
     * @throws If the conversion is not possible
     */
    public static convertToAdg(modifierList: ModifierList): ModifierList {
        // Clone the provided AST node to avoid side effects
        const modifierListNode = cloneDeep(modifierList);
        const convertedModifierList = createModifierListNode();

        // We should merge $csp modifiers into one
        const cspValues: string[] = [];

        modifierListNode.children.forEach((modifierNode) => {
            // Handle regular modifiers conversion and $csp modifiers collection
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

                    if (name === CSP_MODIFIER && value) {
                        // Special case: collect $csp values
                        cspValues.push(value);
                    } else {
                        // Regular case: collect the converted modifiers, if the modifier list
                        // not already contains the same modifier
                        const existingModifier = convertedModifierList.children.find(
                            (m) => m.modifier.value === name && m.exception === exception && m.value?.value === value,
                        );

                        if (!existingModifier) {
                            convertedModifierList.children.push(createModifierNode(name, value, exception));
                        }
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

                convertedModifierList.children.push(
                    createModifierNode(
                        modifierName,
                        // If the redirect resource name is unknown, fall back to the original one
                        // Later, the validator will throw an error if the resource name is invalid
                        convertedRedirectResource || redirectResource,
                        modifierNode.exception,
                    ),
                );

                return;
            }

            // In all other cases, just copy the modifier as is, if the modifier list
            // not already contains the same modifier
            const existingModifier = convertedModifierList.children.find(
                (m) => m.modifier.value === modifierNode.modifier.value
                    && m.exception === modifierNode.exception
                    && m.value?.value === modifierNode.value?.value,
            );

            if (!existingModifier) {
                convertedModifierList.children.push(modifierNode);
            }
        });

        // Merge $csp modifiers into one, then add it to the converted modifier list
        if (cspValues.length > 0) {
            convertedModifierList.children.push(createModifierNode(CSP_MODIFIER, cspValues.join(CSP_SEPARATOR)));
        }

        return convertedModifierList;
    }
}
