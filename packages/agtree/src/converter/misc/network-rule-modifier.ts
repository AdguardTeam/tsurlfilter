/**
 * @file Network rule modifier list converter.
 */

import { type Modifier, type ModifierList } from '../../nodes';
import { SEMICOLON, SPACE } from '../../utils/constants';
import { createModifierNode } from '../../ast-utils/modifiers';
import { BaseConverter } from '../base-interfaces/base-converter';
import { RuleConversionError } from '../../errors/rule-conversion-error';
import { MultiValueMap } from '../../utils/multi-value-map';
import { createConversionResult, type ConversionResult } from '../base-interfaces/conversion-result';
import { cloneModifierListNode } from '../../ast-utils/clone';
import { GenericPlatform, modifiersCompatibilityTable, redirectsCompatibilityTable } from '../../compatibility-tables';
import { isValidResourceType } from '../../compatibility-tables/utils/resource-type-helpers';
import { isUndefined } from '../../utils/type-guards';

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
 * @see {@link https://github.com/gorhill/uBlock/wiki/Resources-Library#empty-redirect-resources}
 */
const UBO_NOOP_TEXT_RESOURCE = 'noop.txt';

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
export class NetworkRuleModifierListConverter extends BaseConverter {
    /**
     * Converts a network rule modifier list to AdGuard format, if possible.
     *
     * @param modifierList Network rule modifier list node to convert
     * @param isException If `true`, the rule is an exception rule
     * @returns An object which follows the {@link ConversionResult} interface. Its `result` property contains
     * the converted node, and its `isConverted` flag indicates whether the original node was converted.
     * If the node was not converted, the result will contain the original node with the same object reference
     * @throws If the conversion is not possible
     */
    public static convertToAdg(modifierList: ModifierList, isException = false): ConversionResult<ModifierList> {
        const conversionMap = new MultiValueMap<number, Modifier>();

        // Special case: $csp modifier
        let cspCount = 0;

        modifierList.children.forEach((modifierNode, index) => {
            const modifierConversions = ADG_CONVERSION_MAP.get(modifierNode.name.value);

            if (modifierConversions) {
                for (const modifierConversion of modifierConversions) {
                    const name = modifierConversion.name(modifierNode.name.value);

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
                    if (name !== modifierNode.name.value || value !== modifierNode.value?.value) {
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
            if (REDIRECT_MODIFIERS.has(modifierNode.name.value)) {
                // Redirect modifiers can't be negated
                if (modifierNode.exception === true) {
                    throw new RuleConversionError(
                        `Modifier '${modifierNode.name.value}' cannot be negated`,
                    );
                }

                // Convert the redirect resource name to ADG format
                const redirectResource = modifierNode.value?.value;

                // Special case: for exception rules, $redirect without value is allowed,
                // and in this case it means an exception for all redirects
                if (!redirectResource && !isException) {
                    throw new RuleConversionError(
                        `No redirect resource specified for '${modifierNode.name.value}' modifier`,
                    );
                }

                // Leave $redirect and $redirect-rule modifiers as is, but convert $rewrite to $redirect
                const modifierName = modifierNode.name.value === ABP_REWRITE_MODIFIER
                    ? REDIRECT_MODIFIER
                    : modifierNode.name.value;

                const convertedRedirectResource = redirectResource
                    ? redirectsCompatibilityTable.getFirst(
                        redirectResource,
                        GenericPlatform.AdgAny,
                    )?.name
                    : undefined;

                // Check if the modifier name or the redirect resource name is different from the original modifier.
                // If so, add the converted modifier to the list
                if (
                    modifierName !== modifierNode.name.value
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
                    if (modifierNode.name.value === CSP_MODIFIER) {
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
                    (m) => m.name.value === modifierNode.name.value
                        && m.exception === modifierNode.exception
                        && m.value?.value === modifierNode.value?.value,
                ) === index,
            );

            return createConversionResult(modifierListClone, true);
        }

        return createConversionResult(modifierList, false);
    }

    /**
     * Converts a network rule modifier list to uBlock format, if possible.
     *
     * @param modifierList Network rule modifier list node to convert
     * @param isException If `true`, the rule is an exception rule
     * @returns An object which follows the {@link ConversionResult} interface. Its `result` property contains
     * the converted node, and its `isConverted` flag indicates whether the original node was converted.
     * If the node was not converted, the result will contain the original node with the same object reference
     * @throws If the conversion is not possible
     */
    // TODO: Optimize
    public static convertToUbo(modifierList: ModifierList, isException = false): ConversionResult<ModifierList> {
        const conversionMap = new MultiValueMap<number, Modifier>();
        const resourceTypeModifiersToAdd = new Set<string>();

        modifierList.children.forEach((modifierNode, index) => {
            const originalModifierName = modifierNode.name.value;
            const modifierData = modifiersCompatibilityTable.getFirst(originalModifierName, GenericPlatform.UboAny);

            // Handle special case: resource redirection modifiers
            if (REDIRECT_MODIFIERS.has(originalModifierName)) {
                // Redirect modifiers cannot be negated
                if (modifierNode.exception === true) {
                    throw new RuleConversionError(
                        `Modifier '${modifierNode.name.value}' cannot be negated`,
                    );
                }

                // Convert the redirect resource name to uBO format
                const redirectResourceName = modifierNode.value?.value;

                // Special case: for exception rules, $redirect without value is allowed,
                // and in this case it means an exception for all redirects
                if (!redirectResourceName && !isException) {
                    throw new RuleConversionError(
                        `No redirect resource specified for '${modifierNode.name.value}' modifier`,
                    );
                }

                if (!redirectResourceName) {
                    // Jump to the next modifier if the redirect resource is not specified
                    return;
                }

                // Leave $redirect and $redirect-rule modifiers as is, but convert $rewrite to $redirect
                const modifierName = modifierNode.name.value === ABP_REWRITE_MODIFIER
                    ? REDIRECT_MODIFIER
                    : modifierNode.name.value;

                const convertedRedirectResourceData = redirectsCompatibilityTable.getFirst(
                    redirectResourceName,
                    GenericPlatform.UboAny,
                );

                const convertedRedirectResourceName = convertedRedirectResourceData?.name ?? redirectResourceName;

                // uBlock requires the $redirect modifier to have a resource type
                // https://github.com/AdguardTeam/Scriptlets/issues/101
                if (convertedRedirectResourceData?.resourceTypes?.length) {
                    // Convert the resource types to uBO modifiers
                    const uboResourceTypeModifiers = redirectsCompatibilityTable.getResourceTypeModifiers(
                        convertedRedirectResourceData,
                        GenericPlatform.UboAny,
                    );

                    // Special case: noop text resource
                    // If any of resource type is already present, we don't need to add other resource types,
                    // otherwise, add all resource types
                    // TODO: Optimize this logic

                    // Check if the current resource is the noop text resource
                    const isNoopTextResource = convertedRedirectResourceName === UBO_NOOP_TEXT_RESOURCE;

                    // Determine if there are any valid resource types already present
                    const hasValidResourceType = modifierList.children.some((modifier) => {
                        const name = modifier.name.value;
                        if (!isValidResourceType(name)) {
                            return false;
                        }

                        const convertedModifierData = modifiersCompatibilityTable.getFirst(
                            name,
                            GenericPlatform.UboAny,
                        );

                        return uboResourceTypeModifiers.has(convertedModifierData?.name ?? name);
                    });

                    // If it's not the noop text resource or if no valid resource types are present
                    if (!isNoopTextResource || !hasValidResourceType) {
                        uboResourceTypeModifiers.forEach((resourceType) => {
                            resourceTypeModifiersToAdd.add(resourceType);
                        });
                    }
                }

                // Check if the modifier name or the redirect resource name is different from the original modifier.
                // If so, add the converted modifier to the list
                if (
                    modifierName !== originalModifierName
                    || (
                        !isUndefined(convertedRedirectResourceName)
                        && convertedRedirectResourceName !== redirectResourceName
                    )
                ) {
                    conversionMap.add(
                        index,
                        createModifierNode(
                            modifierName,
                            // If the redirect resource name is unknown, fall back to the original one
                            // Later, the validator will throw an error if the resource name is invalid
                            convertedRedirectResourceName || redirectResourceName,
                            modifierNode.exception,
                        ),
                    );
                }

                return;
            }

            // Generic modifier conversion
            if (modifierData && modifierData.name !== originalModifierName) {
                conversionMap.add(
                    index,
                    createModifierNode(modifierData.name, modifierNode.value?.value, modifierNode.exception),
                );
            }
        });

        // Prepare the result if there are any converted modifiers or $csp modifiers
        if (conversionMap.size || resourceTypeModifiersToAdd.size) {
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

            // Before returning the result, remove duplicated modifiers
            modifierListClone.children = modifierListClone.children.filter(
                (modifierNode, index, self) => self.findIndex(
                    (m) => m.name.value === modifierNode.name.value
                        && m.exception === modifierNode.exception
                        && m.value?.value === modifierNode.value?.value,
                ) === index,
            );

            if (resourceTypeModifiersToAdd.size) {
                const modifierNameSet = new Set(modifierList.children.map((m) => m.name.value));

                resourceTypeModifiersToAdd.forEach((resourceType) => {
                    if (!modifierNameSet.has(resourceType)) {
                        modifierListClone.children.push(createModifierNode(resourceType));
                    }
                });
            }

            return createConversionResult(modifierListClone, true);
        }

        return createConversionResult(modifierList, false);
    }
}
