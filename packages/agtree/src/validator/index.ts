/**
 * @file Validator for modifiers.
 */

import cloneDeep from 'clone-deep';

import { type ModifierDataMap, getModifiersData, SpecificKey } from '../compatibility-tables';
import { type Modifier } from '../parser/common';
import { AdblockSyntax } from '../utils/adblockers';
import { NEWLINE, SPACE, UNDERSCORE } from '../utils/constants';
import { BLOCKER_PREFIX, SOURCE_DATA_ERROR_PREFIX, VALIDATION_ERROR_PREFIX } from './constants';
import {
    type ValidationResult,
    getInvalidValidationResult,
    getValueRequiredValidationResult,
    isValidNoopModifier,
    getSpecificBlockerData,
    getAllModifierNames,
} from './helpers';
import { validateValue } from './value';

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
        return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.NOT_SUPPORTED}: '${modifierName}'`);
    }

    // e.g. 'object-subrequest'
    if (specificBlockerData[SpecificKey.Removed]) {
        return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.REMOVED}: '${modifierName}'`);
    }

    if (specificBlockerData[SpecificKey.Deprecated]) {
        if (!specificBlockerData[SpecificKey.DeprecationMessage]) {
            throw new Error(`${SOURCE_DATA_ERROR_PREFIX.NO_DEPRECATION_MESSAGE}: '${modifierName}'`);
        }
        // prepare the message which is multiline in the yaml file
        const warn = specificBlockerData[SpecificKey.DeprecationMessage].replace(NEWLINE, SPACE);
        return {
            valid: true,
            warn,
        };
    }

    if (specificBlockerData[SpecificKey.BlockOnly] && isException) {
        return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.BLOCK_ONLY}: '${modifierName}'`);
    }

    if (specificBlockerData[SpecificKey.ExceptionOnly] && !isException) {
        return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.EXCEPTION_ONLY}: '${modifierName}'`);
    }

    // e.g. '~domain=example.com'
    if (!specificBlockerData[SpecificKey.Negatable] && modifier.exception) {
        return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_MODIFIER}: '${modifierName}'`);
    }

    // e.g. 'domain'
    if (specificBlockerData[SpecificKey.Assignable]) {
        /**
         * Some assignable modifiers can be used without a value,
         * e.g. '@@||example.com^$cookie'.
         */
        if (specificBlockerData[SpecificKey.ValueOptional]) {
            // no need to check the value if it is optional
            return { valid: true };
        }

        if (!modifier.value) {
            return getValueRequiredValidationResult(modifierName);
        }

        /**
         * TODO: consider to return `{ valid: true, warn: 'Modifier value may be specified' }` (???)
         * for $stealth modifier without a value
         * but only after the extension will support value for $stealth:
         * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2107
         */

        if (!specificBlockerData[SpecificKey.ValueFormat]) {
            throw new Error(`${SOURCE_DATA_ERROR_PREFIX.NO_VALUE_FORMAT_FOR_ASSIGNABLE}: '${modifierName}'`);
        }

        return validateValue(modifier, specificBlockerData[SpecificKey.ValueFormat]);
    }

    if (modifier?.value) {
        // e.g. 'third-party=true'
        return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.VALUE_FORBIDDEN}: '${modifierName}'`);
    }

    return { valid: true };
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

// TODO: move to modifier.ts and use index.ts only for exporting
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
                    `${VALIDATION_ERROR_PREFIX.INVALID_NOOP}: '${modifier.modifier.value}'`,
                );
            }
            // otherwise, replace the modifier value with single underscore.
            // it is needed to check whether the modifier is supported by specific adblocker due to the syntax
            modifier.modifier.value = UNDERSCORE;
        }

        if (!this.exists(modifier)) {
            return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.NOT_EXISTENT}: '${modifier.modifier.value}'`);
        }
        // for 'Common' syntax we cannot check something more
        if (syntax === AdblockSyntax.Common) {
            return { valid: true };
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
