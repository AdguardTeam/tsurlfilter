/**
 * @file Validator for modifiers.
 */

import cloneDeep from 'clone-deep';

import {
    type ModifierData,
    type ModifierDataMap,
    type SpecificPlatformModifierData,
    getModifiersData,
    SpecificKey,
} from '../compatibility-tables';
import { type Modifier } from '../parser/common';
import { AdblockSyntax } from '../utils/adblockers';
import { NEWLINE, SPACE, UNDERSCORE } from '../utils/constants';
import { INVALID_ERROR_PREFIX } from './constants';

const BLOCKER_PREFIX = {
    [AdblockSyntax.Adg]: 'adg_',
    [AdblockSyntax.Ubo]: 'ubo_',
    [AdblockSyntax.Abp]: 'abp_',
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
 * Returns modifier data for given modifier name and adblocker.
 *
 * @param modifiersData Parsed all modifiers data map.
 * @param blockerPrefix Prefix of the adblocker, e.g. 'adg_', 'ubo_', or 'abp_'.
 * @param modifierName Modifier name.
 *
 * @returns Modifier data or `null` if not found.
 */
const getSpecificBlockerData = (
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
 * Fully checks whether the given `modifier` valid for given blocker `syntax`:
 * is it supported by the blocker, deprecated, assignable, negatable, etc.
 *
 * @param modifiersData Parsed all modifiers data map.
 * @param syntax Adblock syntax to check the modifier for.
 * 'Common' is not supported, it should be specific — 'AdGuard', 'uBlockOrigin', or 'AdblockPlus'.
 * @param modifier Parsed modifier AST node.
 * @param isException Whether the modifier is used in exception rule.
 * Needed to check whether the modifier is allowed only in blocking or exception rules.
 *
 * @returns Result of modifier validation.
 */
const validateForSpecificSyntax = (
    modifiersData: ModifierDataMap,
    syntax: AdblockSyntax,
    modifier: Modifier,
    isException: boolean,
): ValidationResult => {
    if (syntax === AdblockSyntax.Common) {
        throw new Error(`Syntax should be specific, '${AdblockSyntax.Common}' is not supported`);
    }

    const modifierName = modifier.modifier.value;

    const blockerPrefix = BLOCKER_PREFIX[syntax];
    if (!blockerPrefix) {
        throw new Error(`Unknown syntax: ${syntax}`);
    }

    // needed for validation of negation, assignment, etc.
    const specificBlockerData = getSpecificBlockerData(modifiersData, blockerPrefix, modifierName);

    // if no specific blocker data is found
    if (!specificBlockerData) {
        return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.NOT_SUPPORTED}: '${modifierName}'`);
    }

    // e.g. 'object-subrequest'
    if (specificBlockerData[SpecificKey.Removed]) {
        return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.REMOVED}: '${modifierName}'`);
    }

    if (specificBlockerData[SpecificKey.Deprecated]) {
        if (!specificBlockerData[SpecificKey.DeprecationMessage]) {
            throw new Error('Deprecation notice is required for deprecated modifier');
        }
        // prepare the message which is multiline in the yaml file
        const warn = specificBlockerData[SpecificKey.DeprecationMessage].replace(NEWLINE, SPACE);
        return {
            ok: true,
            warn,
        };
    }

    if (specificBlockerData[SpecificKey.BlockOnly] && isException) {
        return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.BLOCK_ONLY}: '${modifierName}'`);
    }

    if (specificBlockerData[SpecificKey.ExceptionOnly] && !isException) {
        return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.EXCEPTION_ONLY}: '${modifierName}'`);
    }

    // e.g. '~domain=example.com'
    if (!specificBlockerData[SpecificKey.Negatable] && modifier.exception) {
        return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.NOT_NEGATABLE}: '${modifierName}'`);
    }

    // e.g. 'domain'
    if (specificBlockerData[SpecificKey.Assignable]) {
        /**
         * Some assignable modifiers can be used without a value,
         * e.g. '@@||example.com^$cookie'.
         */
        if (!modifier.value
            // value should be specified if it is not optional
            && !specificBlockerData[SpecificKey.ValueOptional]) {
            return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.VALUE_REQUIRED}: '${modifierName}'`);
        }
        /**
         * TODO: consider to return `{ ok: true, warn: 'Modifier value may be specified' }` (???)
         * for $stealth modifier without a value
         * but only after the extension will support value for $stealth:
         * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2107
         */
    } else if (modifier?.value) {
        return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.VALUE_FORBIDDEN}: '${modifierName}'`);
    }

    return { ok: true };
};

/**
 * Returns documentation URL for given modifier and adblocker.
 *
 * @param modifiersData Parsed all modifiers data map.
 * @param blockerPrefix Prefix of the adblocker, e.g. 'adg_', 'ubo_', or 'abp_'.
 * @param modifier Parsed modifier AST node.
 *
 * @returns Documentation URL or `null` if not found.
 */
const getBlockerDocumentationLink = (
    modifiersData: ModifierDataMap,
    blockerPrefix: string,
    modifier: Modifier,
): string | null => {
    const specificBlockerData = getSpecificBlockerData(modifiersData, blockerPrefix, modifier.modifier.value);
    return specificBlockerData?.docs || null;
};

/**
 * Validates the noop modifier (i.e. only underscores).
 *
 * @param value Value of the modifier.
 *
 * @returns True if the modifier is valid, false otherwise.
 */
const isValidNoopModifier = (value: string): boolean => {
    return value.split('').every((char) => char === UNDERSCORE);
};

/**
 * Modifier validator class.
 */
class ModifierValidator {
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

    /**
     * Simply checks whether the modifier exists in any adblocker.
     *
     * **Deprecated** and **removed** modifiers are considered as **existent**.
     *
     * @param modifier Already parsed modifier AST node.
     *
     * @returns True if modifier exists, false otherwise.
     */
    public exists = (modifier: Modifier): boolean => {
        return this.allModifierNames.has(modifier.modifier.value);
    };

    /**
     * Checks whether the given `modifier` is valid for specified `syntax`.
     *
     * For `Common` syntax it simply checks whether the modifier exists.
     * For specific syntax the validation is more complex —
     * deprecated, assignable, negatable and other requirements are checked.
     *
     * @param syntax Adblock syntax to check the modifier for.
     * @param rawModifier Modifier AST node.
     * @param isException Whether the modifier is used in exception rule, default to false.
     * Needed to check whether the modifier is allowed only in blocking or exception rules.
     *
     * @returns Result of modifier validation.
     */
    public validate = (syntax: AdblockSyntax, rawModifier: Modifier, isException = false): ValidationResult => {
        const modifier = cloneDeep(rawModifier);

        // special case: handle noop modifier which may be used as multiple underscores (not just one)
        // https://adguard.com/kb/general/ad-filtering/create-own-filters/#noop-modifier
        if (modifier.modifier.value.startsWith(UNDERSCORE)) {
            // check whether the modifier value contains something else besides underscores
            if (!isValidNoopModifier(modifier.modifier.value)) {
                return getInvalidValidationResult(
                    `${INVALID_ERROR_PREFIX.INVALID_NOOP}: '${modifier.modifier.value}'`,
                );
            }
            // otherwise, replace the modifier value with single underscore.
            // it is needed to check whether the modifier is supported by specific adblocker due to the syntax
            modifier.modifier.value = UNDERSCORE;
        }

        if (!this.exists(modifier)) {
            return getInvalidValidationResult(`${INVALID_ERROR_PREFIX.NOT_EXISTENT}: '${modifier.modifier.value}'`);
        }
        // for 'Common' syntax we cannot check something more
        if (syntax === AdblockSyntax.Common) {
            return { ok: true };
        }
        return validateForSpecificSyntax(this.modifiersData, syntax, modifier, isException);
    };

    /**
     * Returns AdGuard documentation URL for given modifier.
     *
     * @param modifier Parsed modifier AST node.
     *
     * @returns AdGuard documentation URL or `null` if not found.
     */
    public getAdgDocumentationLink = (modifier: Modifier): string | null => {
        if (!this.exists(modifier)) {
            return null;
        }
        return getBlockerDocumentationLink(this.modifiersData, BLOCKER_PREFIX[AdblockSyntax.Adg], modifier);
    };

    /**
     * Returns Ublock Origin documentation URL for given modifier.
     *
     * @param modifier Parsed modifier AST node.
     *
     * @returns Ublock Origin documentation URL or `null` if not found.
     */
    public getUboDocumentationLink = (modifier: Modifier): string | null => {
        if (!this.exists(modifier)) {
            return null;
        }
        return getBlockerDocumentationLink(this.modifiersData, BLOCKER_PREFIX[AdblockSyntax.Ubo], modifier);
    };

    /**
     * Returns AdBlock Plus documentation URL for given modifier.
     *
     * @param modifier Parsed modifier AST node.
     *
     * @returns AdBlock Plus documentation URL or `null` if not found.
     */
    public getAbpDocumentationLink = (modifier: Modifier): string | null => {
        if (!this.exists(modifier)) {
            return null;
        }
        return getBlockerDocumentationLink(this.modifiersData, BLOCKER_PREFIX[AdblockSyntax.Abp], modifier);
    };
}

export const modifierValidator = new ModifierValidator();
