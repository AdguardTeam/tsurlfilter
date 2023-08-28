import { type ModifierData, type ModifierDataMap, type SpecificPlatformModifierData } from '../compatibility-tables';
import { UNDERSCORE } from '../utils/constants';
import { VALIDATION_ERROR_PREFIX } from './constants';

/**
 * Result of modifier validation:
 * - `{ valid: true }` for valid and _fully supported_ modifier;
 * - `{ valid: true, warn: <deprecation notice> }` for valid
 *   and _still supported but deprecated_ modifier;
 * - otherwise `{ valid: true, error: <invalidity reason> }`
 */
export type ValidationResult = {
    valid: boolean,
    error?: string,
    warn?: string,
};

/**
 * Validates the noop modifier (i.e. only underscores).
 *
 * @param value Value of the modifier.
 *
 * @returns True if the modifier is valid, false otherwise.
 */
export const isValidNoopModifier = (value: string): boolean => {
    return value.split('').every((char) => char === UNDERSCORE);
};

/**
 * Returns invalid validation result with given error message.
 *
 * @param error Error message.
 *
 * @returns Validation result `{ valid: false, error }`.
 */
export const getInvalidValidationResult = (error: string): ValidationResult => {
    return {
        valid: false,
        error,
    };
};

/**
 * Returns invalid validation result which uses {@link VALIDATION_ERROR_PREFIX.VALUE_REQUIRED} as prefix
 * and specifies the given `modifierName` in the error message.
 *
 * @param modifierName Modifier name.
 *
 * @returns Validation result `{ valid: false, error }`.
 */
export const getValueRequiredValidationResult = (modifierName: string): ValidationResult => {
    return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.VALUE_REQUIRED}: '${modifierName}'`);
};

/**
 * Collects names and aliases for all supported modifiers.
 * Deprecated and removed modifiers are included because they are known and existent
 * and they should be validated properly.
 *
 * @param dataMap Parsed all modifiers data.
 *
 * @returns Set of all modifier names (and their aliases).
 */
export const getAllModifierNames = (dataMap: ModifierDataMap): Set<string> => {
    const names = new Set<string>();
    dataMap.forEach((modifierData: ModifierData) => {
        Object.keys(modifierData).forEach((blockerId) => {
            const blockerData = modifierData[blockerId];
            names.add(blockerData.name);
            if (!blockerData.aliases) {
                return;
            }
            blockerData.aliases.forEach((alias) => names.add(alias));
        });
    });
    return names;
};

/**
 * Returns modifier data for given modifier name and adblocker.
 *
 * @param modifiersData Parsed all modifiers data map.
 * @param blockerPrefix Prefix of the adblocker, e.g. 'adg_', 'ubo_', or 'abp_'.
 * @param modifierName Modifier name.
 *
 * @returns Modifier data or `null` if not found.
 */
export const getSpecificBlockerData = (
    modifiersData: ModifierDataMap,
    blockerPrefix: string,
    modifierName: string,
): SpecificPlatformModifierData | null => {
    let specificBlockerData: SpecificPlatformModifierData | null = null;

    modifiersData.forEach((modifierData: ModifierData) => {
        Object.keys(modifierData).forEach((blockerId) => {
            const blockerData = modifierData[blockerId];
            if (blockerData.name === modifierName
                || (blockerData.aliases && blockerData.aliases.includes(modifierName))) {
                // modifier is found by name or alias
                // so its support by specific adblocker should be checked
                if (blockerId.startsWith(blockerPrefix)) {
                    // so maybe other data objects should be checked as well (not sure)
                    specificBlockerData = blockerData;
                }
            }
        });
    });

    return specificBlockerData;
};
