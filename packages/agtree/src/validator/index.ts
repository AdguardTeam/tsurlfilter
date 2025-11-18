/**
 * @file Validator for modifiers.
 */

import { sprintf } from 'sprintf-js';

import { type Modifier } from '../nodes';
import { NEWLINE, SPACE, UNDERSCORE } from '../utils/constants';
import { SOURCE_DATA_ERROR_PREFIX, VALIDATION_ERROR_PREFIX } from './constants';
import { type ValidationResult, getInvalidValidationResult, getValueRequiredValidationResult } from './helpers';
import { validateValue } from './value';
import { modifiersCompatibilityTable } from '../compatibility-tables/modifiers';
import { getHumanReadablePlatformName, type SpecificPlatform } from '../compatibility-tables';
import { isValidNoopModifier } from '../utils/noop-modifier';

/**
 * Fully checks whether the given `modifier` valid for given blocker `platforms`:
 * is it supported by the blocker, deprecated, assignable, negatable, etc.
 *
 * @param platform Platform to check the modifier for.
 * @param modifier Parsed modifier AST node.
 * @param isException Whether the modifier is used in exception rule.
 * Needed to check whether the modifier is allowed only in blocking or exception rules.
 *
 * @returns Result of modifier validation.
 */
const validateForSpecificPlatform = (
    platform: SpecificPlatform,
    modifier: Modifier,
    isException: boolean,
): ValidationResult => {
    if (platform === 0) {
        throw new Error('No platforms specified');
    }

    const modifierName = modifier.name.value;

    // needed for validation of negation, assignment, etc.
    const specificBlockerData = modifiersCompatibilityTable.getSingle(modifierName, platform);

    // if no specific blocker data is found
    if (!specificBlockerData) {
        return getInvalidValidationResult(
            sprintf(VALIDATION_ERROR_PREFIX.NOT_SUPPORTED, getHumanReadablePlatformName(platform)),
        );
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
     * Checks whether the given `modifier` is valid for specified `platform`.
     * It checks whether the modifier is supported by the blocker, deprecated, assignable, negatable, etc.
     *
     * @param platform Platform to check the modifier for.
     * @param modifier Modifier AST node.
     * @param isException Whether the modifier is used in exception rule, default to false.
     * Needed to check whether the modifier is allowed only in blocking or exception rules.
     *
     * @returns Result of modifier validation.
     */
    public validate = (platform: SpecificPlatform, modifier: Modifier, isException = false): ValidationResult => {
        // special case: handle noop modifier which may be used as multiple underscores (not just one)
        // https://adguard.com/kb/general/ad-filtering/create-own-filters/#noop-modifier
        if (modifier.name.value.startsWith(UNDERSCORE)) {
            // check whether the modifier value contains something else besides underscores
            if (!isValidNoopModifier(modifier.name.value)) {
                return getInvalidValidationResult(
                    `${VALIDATION_ERROR_PREFIX.INVALID_NOOP}: '${modifier.name.value}'`,
                );
            }
        }

        if (!this.exists(modifier)) {
            return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.NOT_EXISTENT}: '${modifier.name.value}'`);
        }

        return validateForSpecificPlatform(platform, modifier, isException);
    };
}

export const modifierValidator = new ModifierValidator();
