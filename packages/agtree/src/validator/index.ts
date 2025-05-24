/**
 * @file Validator for modifiers.
 */

import { type Modifier } from '../nodes/index.js';
import { AdblockSyntax } from '../utils/adblockers.js';
import { NEWLINE, SPACE, UNDERSCORE } from '../utils/constants.js';
import { BLOCKER_PREFIX, SOURCE_DATA_ERROR_PREFIX, VALIDATION_ERROR_PREFIX } from './constants.js';
import {
    type ValidationResult,
    getInvalidValidationResult,
    getValueRequiredValidationResult,
    isValidNoopModifier,
} from './helpers.js';
import { validateValue } from './value.js';
import { clone } from '../utils/clone.js';
import { modifiersCompatibilityTable } from '../compatibility-tables/modifiers.js';
import { GenericPlatform } from '../compatibility-tables/platforms.js';

const convertSyntaxToGenericPlatform = (syntax: AdblockSyntax): GenericPlatform => {
    switch (syntax) {
        case AdblockSyntax.Adg:
            return GenericPlatform.AdgAny;
        case AdblockSyntax.Ubo:
            return GenericPlatform.UboAny;
        case AdblockSyntax.Abp:
            return GenericPlatform.AbpAny;
        default:
            throw new Error(`Unknown syntax: ${syntax}`);
    }
};

/**
 * Fully checks whether the given `modifier` valid for given blocker `syntax`:
 * is it supported by the blocker, deprecated, assignable, negatable, etc.
 *
 * @param syntax Adblock syntax to check the modifier for.
 * 'Common' is not supported, it should be specific — 'AdGuard', 'uBlockOrigin', or 'AdblockPlus'.
 * @param modifier Parsed modifier AST node.
 * @param isException Whether the modifier is used in exception rule.
 * Needed to check whether the modifier is allowed only in blocking or exception rules.
 *
 * @returns Result of modifier validation.
 */
const validateForSpecificSyntax = (
    syntax: AdblockSyntax,
    modifier: Modifier,
    isException: boolean,
): ValidationResult => {
    if (syntax === AdblockSyntax.Common) {
        throw new Error(`Syntax should be specific, '${AdblockSyntax.Common}' is not supported`);
    }

    const modifierName = modifier.name.value;

    const blockerPrefix = BLOCKER_PREFIX[syntax];
    if (!blockerPrefix) {
        throw new Error(`Unknown syntax: ${syntax}`);
    }

    // needed for validation of negation, assignment, etc.
    const specificBlockerData = modifiersCompatibilityTable.getFirst(
        modifierName,
        convertSyntaxToGenericPlatform(syntax),
    );

    // if no specific blocker data is found
    if (!specificBlockerData) {
        return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.NOT_SUPPORTED}: '${modifierName}'`);
    }

    // e.g. 'object-subrequest'
    if (specificBlockerData.removed) {
        return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.REMOVED}: '${modifierName}'`);
    }

    if (specificBlockerData.deprecated) {
        if (!specificBlockerData.deprecationMessage) {
            throw new Error(`${SOURCE_DATA_ERROR_PREFIX.NO_DEPRECATION_MESSAGE}: '${modifierName}'`);
        }
        // prepare the message which is multiline in the yaml file
        const warn = specificBlockerData.deprecationMessage.replace(NEWLINE, SPACE);
        return {
            valid: true,
            warn,
        };
    }

    if (specificBlockerData.blockOnly && isException) {
        return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.BLOCK_ONLY}: '${modifierName}'`);
    }

    if (specificBlockerData.exceptionOnly && !isException) {
        return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.EXCEPTION_ONLY}: '${modifierName}'`);
    }

    // e.g. '~domain=example.com'
    if (!specificBlockerData.negatable && modifier.exception) {
        return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_MODIFIER}: '${modifierName}'`);
    }

    // e.g. 'domain'
    if (specificBlockerData.assignable) {
        if (!modifier.value) {
            // TODO: ditch value_optional after custom validators are implemented for value_format for all modifiers.
            // This checking should be done in each separate custom validator,
            // because $csp and $permissions without value can be used only in extension rules,
            // but $cookie with no value can be used in both blocking and exception rules.
            /**
             * Some assignable modifiers can be used without a value,
             * e.g. '@@||example.com^$cookie'.
             */
            if (specificBlockerData.valueOptional) {
                return { valid: true };
            }
            // for other assignable modifiers the value is required
            return getValueRequiredValidationResult(modifierName);
        }

        /**
         * TODO: consider to return `{ valid: true, warn: 'Modifier value may be specified' }` (???)
         * for $stealth modifier without a value
         * but only after the extension will support value for $stealth:
         * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2107
         */

        if (!specificBlockerData.valueFormat) {
            throw new Error(`${SOURCE_DATA_ERROR_PREFIX.NO_VALUE_FORMAT_FOR_ASSIGNABLE}: '${modifierName}'`);
        }

        return validateValue(modifier, specificBlockerData.valueFormat, specificBlockerData.valueFormatFlags);
    }

    if (modifier?.value) {
        // e.g. 'third-party=true'
        return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.VALUE_FORBIDDEN}: '${modifierName}'`);
    }

    return { valid: true };
};

// TODO: move to modifier.ts and use index.ts only for exporting
/**
 * Modifier validator class.
 */
class ModifierValidator {
    /**
     * Simply checks whether the modifier exists in any adblocker.
     *
     * **Deprecated** and **removed** modifiers are considered as **existent**.
     *
     * @param modifier Already parsed modifier AST node.
     *
     * @returns True if modifier exists, false otherwise.
     */
    // eslint-disable-next-line class-methods-use-this
    public exists = (modifier: Modifier): boolean => {
        return modifiersCompatibilityTable.existsAny(modifier.name.value);
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
        const modifier = clone(rawModifier);

        // special case: handle noop modifier which may be used as multiple underscores (not just one)
        // https://adguard.com/kb/general/ad-filtering/create-own-filters/#noop-modifier
        if (modifier.name.value.startsWith(UNDERSCORE)) {
            // check whether the modifier value contains something else besides underscores
            if (!isValidNoopModifier(modifier.name.value)) {
                return getInvalidValidationResult(
                    `${VALIDATION_ERROR_PREFIX.INVALID_NOOP}: '${modifier.name.value}'`,
                );
            }
            // otherwise, replace the modifier value with single underscore.
            // it is needed to check whether the modifier is supported by specific adblocker due to the syntax
            modifier.name.value = UNDERSCORE;
        }

        if (!this.exists(modifier)) {
            return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.NOT_EXISTENT}: '${modifier.name.value}'`);
        }
        // for 'Common' syntax we cannot check something more
        if (syntax === AdblockSyntax.Common) {
            return { valid: true };
        }
        return validateForSpecificSyntax(syntax, modifier, isException);
    };
}

export const modifierValidator = new ModifierValidator();
