import { AdblockSyntax } from '../utils/adblockers';
import {
    CAPITAL_LETTERS,
    NUMBERS,
    SMALL_LETTERS,
    UNDERSCORE,
} from '../utils/constants';

/**
 * Prefixes for different adblockers to describe the platform-specific modifiers data
 * stored in the yaml files.
 */
export const BLOCKER_PREFIX = {
    [AdblockSyntax.Adg]: 'adg_',
    [AdblockSyntax.Ubo]: 'ubo_',
    [AdblockSyntax.Abp]: 'abp_',
};

/**
 * Set of all allowed characters for app name except the dot `.`.
 */
export const APP_NAME_ALLOWED_CHARS = new Set([
    ...CAPITAL_LETTERS,
    ...SMALL_LETTERS,
    ...NUMBERS,
    UNDERSCORE,
]);

/**
 * Allowed methods for $method modifier.
 *
 * @see {@link https://adguard.app/kb/general/ad-filtering/create-own-filters/#method-modifier}
 */
export const ALLOWED_METHODS = new Set([
    'connect',
    'delete',
    'get',
    'head',
    'options',
    'patch',
    'post',
    'put',
    'trace',
]);

/**
 * Prefixes for error messages used in modifier validation.
 */
export const VALIDATION_ERROR_PREFIX = {
    BLOCK_ONLY: 'Only blocking rules may contain the modifier',
    EXCEPTION_ONLY: 'Only exception rules may contain the modifier',
    INVALID_LIST_VALUES: 'Invalid values for the modifier',
    INVALID_NOOP: 'Invalid noop modifier',
    MIXED_NEGATIONS: 'Simultaneous usage of negated and not negated values is forbidden for the modifier',
    NOT_EXISTENT: 'Non-existent modifier',
    NOT_NEGATABLE_MODIFIER: 'Non-negatable modifier',
    NOT_NEGATABLE_VALUE: 'Values cannot be negated for the modifier',
    NOT_SUPPORTED: 'The adblocker does not support the modifier',
    REMOVED: 'Removed and no longer supported modifier',
    VALUE_FORBIDDEN: 'Value is not allowed for the modifier',
    VALUE_INVALID: 'Value is invalid for the modifier',
    VALUE_REQUIRED: 'Value is required for the modifier',
};

/**
 * Prefixes for error messages related to issues in the source YAML files' data.
 */
export const SOURCE_DATA_ERROR_PREFIX = {
    INVALID_VALUE_FORMAT_REGEXP: "Invalid regular expression in 'value_format' for the modifier",
    NO_DEPRECATION_MESSAGE: "Property 'deprecation_message' is required for the 'deprecated' modifier",
    NO_VALUE_FORMAT_FOR_ASSIGNABLE: "Property 'value_format' should be specified for the assignable modifier",
};
