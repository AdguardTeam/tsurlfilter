/**
 * @file Validator for modifiers.
 */

import {
    type ModifierData,
    type ModifierDataMap,
    type SpecificPlatformModifierData,
    getModifiersData,
} from '../compatibility-tables';
import { Modifier } from '../parser/common';
import { INVALID_ERROR_PREFIX } from './constants';

const BLOCKER_PREFIX = {
    ADG: 'adg_',
    UBO: 'ubo_',
    ABP: 'abp_',
};

/**
 * Result of modifier validation:
 * - `{ ok: true }` for valid and _fully supported_ modifier;
 * - `{ ok: true, warn: <deprecation notice> }` for valid
 *   and _still supported but deprecated_ modifier;
 * - otherwise `{ ok: true, error: <invalidity reason> }`
 */
type ValidationResult = {
    ok: boolean,
    error?: string,
    warn?: string,
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
const getAllModifierNames = (dataMap: ModifierDataMap): Set<string> => {
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
 * Returns invalid validation result with given error message.
 *
 * @param error Error message.
 *
 * @returns Validation result `{ ok: false, error }`.
 */
const getInvalidValidationResult = (error: string): ValidationResult => {
    return {
        ok: false,
        error,
    };
};

/**
 * Fully checks whether the given is valid for given blocker:
 * is it supported by the blocker, deprecated, assignable, negatable, etc.
 *
 * @param modifiersData Parsed all modifiers data map.
 * @param blockerPrefix Prefix of the blocker, e.g. 'adg_', 'ubo_', or 'abp_'.
 * @param modifier Parsed modifier AST node.
 * @param isBlocking Whether the modifier is used in blocking rule.
 * Needed to check whether the modifier is allowed only in blocking or exception rules.
 *
 * @returns Result of modifier validation.
 */
const validateForBlocker = (
    modifiersData: ModifierDataMap,
    blockerPrefix: string,
    modifier: Modifier,
    isBlocking: boolean,
): ValidationResult => {
    // needed for validation of negation, assignment, etc.
    let specificBlockerData: SpecificPlatformModifierData | undefined;

    const modifierName = modifier.modifier.value;

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

    // if no specific blocker data is found
    if (!specificBlockerData) {
        return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.NOT_SUPPORTED}: '${modifierName}'`);
    }

    // e.g. 'object-subrequest'
    if (specificBlockerData.removed) {
        return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.REMOVED}: '${modifierName}'`);
    }

    if (specificBlockerData.deprecated) {
        if (!specificBlockerData.deprecation_message) {
            throw new Error('Deprecation notice is required for deprecated modifier');
        }
        return {
            ok: true,
            warn: specificBlockerData.deprecation_message,
        };
    }

    if (specificBlockerData.block_only && !isBlocking) {
        return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.BLOCK_ONLY}: '${modifierName}'`);
    }

    if (specificBlockerData.exception_only && isBlocking) {
        return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.EXCEPTION_ONLY}: '${modifierName}'`);
    }

    // e.g. '~domain=example.com'
    if (!specificBlockerData.negatable && modifier.exception) {
        return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.NOT_NEGATABLE}: '${modifierName}'`);
    }

    // e.g. 'domain'
    if (specificBlockerData.assignable) {
        /**
         * exception_only modifier 'stealth' is assignable
         * but it also may be used without value as well -- `$stealth` or `$stealth=dpi`
         */
        if (!modifier.value
            /**
             * TODO: consider to return `{ ok: true, warn: 'Modifier value may be specified' }` (???)
             * after the extension will support stealth mode with value
             * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2107
             */
            && !specificBlockerData.exception_only) {
            return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.VALUE_REQUIRED}: '${modifierName}'`);
        }
    } else if (modifier?.value) {
        return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.VALUE_FORBIDDEN}: '${modifierName}'`);
    }

    return { ok: true };
};

/**
 * Modifier validator class.
 */
export class ModifierValidator {
    /**
     * Map of all modifiers data parsed from yaml files.
     */
    private modifiersData: ModifierDataMap;

    /**
     * List of all modifier names for any adblocker.
     *
     * Please note that **deprecated** modifiers are **included** as well.
     */
    private allModifierNames: Set<string>;

    constructor() {
        // data map based on yaml files
        this.modifiersData = getModifiersData();

        this.allModifierNames = getAllModifierNames(this.modifiersData);
    }

    // TODO: check the statement about deprecated modifiers.
    /**
     * Simply checks whether the modifier exists in any adblocker.
     *
     * **Deprecated** modifiers are considered as **existent**.
     *
     * @param modifier Already parsed modifier AST node.
     *
     * @returns True if modifier exists, false otherwise.
     * If given modifier is a string and it cannot be parsed as a valid modifier,
     * e.g. 'domain=', false is returned.
     */
    public exists = (modifier: Modifier): boolean => {
        return this.allModifierNames.has(modifier.modifier.value);
    };

    /**
     * Checks whether the given modifier is valid for AdGuard.
     *
     * @param modifier Already parsed modifier AST node.
     * @param isBlocking Whether the modifier is used in blocking rule, **default to true**.
     * Needed to check whether the modifier is allowed only in blocking or exception rules.
     *
     * @returns Result of modifier validation.
     */
    public validateAdg = (modifier: Modifier, isBlocking = true): ValidationResult => {
        if (!this.exists(modifier)) {
            return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.NOT_EXISTENT}: '${modifier.modifier.value}'`);
        }
        return validateForBlocker(this.modifiersData, BLOCKER_PREFIX.ADG, modifier, isBlocking);
    };

    /**
     * Checks whether the given modifier is valid for Ublock Origin.
     *
     * @param modifier Already parsed modifier AST node.
     * @param isBlocking Whether the modifier is used in blocking rule, default to true.
     * Needed to check whether the modifier is allowed only in blocking or exception rules.
     *
     * @returns Result of modifier validation.
     */
    public validateUbo = (modifier: Modifier, isBlocking = true): ValidationResult => {
        if (!this.exists(modifier)) {
            return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.NOT_EXISTENT}: '${modifier.modifier.value}'`);
        }
        return validateForBlocker(this.modifiersData, BLOCKER_PREFIX.UBO, modifier, isBlocking);
    };

    /**
     * Checks whether the given modifier is valid for AdBlock Plus.
     *
     * @param modifier Already parsed modifier AST node.
     * @param isBlocking Whether the modifier is used in blocking rule, default to true.
     * Needed to check whether the modifier is allowed only in blocking or exception rules.
     *
     * @returns Result of modifier validation.
     */
    public validateAbp = (modifier: Modifier, isBlocking = true): ValidationResult => {
        if (!this.exists(modifier)) {
            return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.NOT_EXISTENT}: '${modifier.modifier.value}'`);
        }
        return validateForBlocker(this.modifiersData, BLOCKER_PREFIX.ABP, modifier, isBlocking);
    };
}
