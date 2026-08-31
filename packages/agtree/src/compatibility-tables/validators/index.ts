/**
 * @file Validators for modifier value formats.
 */

import { type Platform } from '../platform';

import { CspValueValidator } from './csp-value';
import { PermissionsValueValidator } from './permissions-value';
import { PipeSeparatedAppsValidator } from './pipe-separated-apps';
import { PipeSeparatedDenyAllowDomainsValidator } from './pipe-separated-denyallow-domains';
import { PipeSeparatedDomainsValidator } from './pipe-separated-domains';
import { PipeSeparatedMethodsValidator } from './pipe-separated-methods';
import { PipeSeparatedStealthOptionsValidator } from './pipe-separated-stealth-options';
import { ReferrerPolicyValueValidator } from './referrerpolicy-value';
import { RegexpValidator } from './regexp';
import { type ValidationContext, type Validator, type ValidatorFn } from './types';
import { UrlValidator } from './url';

/**
 * All available validators.
 */
const VALIDATORS: Validator[] = [
    PipeSeparatedAppsValidator,
    CspValueValidator,
    PipeSeparatedDenyAllowDomainsValidator,
    PipeSeparatedDomainsValidator,
    PipeSeparatedMethodsValidator,
    PermissionsValueValidator,
    ReferrerPolicyValueValidator,
    PipeSeparatedStealthOptionsValidator,
    RegexpValidator,
    UrlValidator,
];

/**
 * Validator name for redirect resource validation.
 * This validator is platform-aware and handled directly in ModifiersCompatibilityTable
 * and the legacy validator, rather than through the generic validator registry.
 * The name is registered in KNOWN_VALIDATORS so the XRegExp preprocessor skips it.
 */
export const REDIRECT_RESOURCE_VALIDATOR_NAME = 'redirect_resource';

/**
 * Map of validator names to their validation functions.
 */
const VALIDATOR_MAP: Record<string, ValidatorFn> = Object.fromEntries(
    VALIDATORS.map((validator) => [validator.name, validator.validate]),
);

/**
 * Set of known validator names.
 * Derived from VALIDATORS - these validators don't need to be validated as regex patterns.
 * Also includes REDIRECT_RESOURCE_VALIDATOR_NAME which is platform-aware and handled separately.
 */
export const KNOWN_VALIDATORS: ReadonlySet<string> = new Set([
    ...VALIDATORS.map((v) => v.name),
    REDIRECT_RESOURCE_VALIDATOR_NAME,
]);

/**
 * Checks if the given validator name is registered in the validator map
 * and can safely be called through {@link validate}.
 *
 * **Note**: this is intentionally distinct from {@link KNOWN_VALIDATORS},
 * which also includes `redirect_resource` (so the XRegExp preprocessor skips it)
 * but does NOT register it in the map. Use `KNOWN_VALIDATORS.has()` when you
 * need preprocessor-awareness; use this predicate when you need to guard a
 * call to {@link validate}.
 *
 * @param validatorName Name of the validator to check.
 *
 * @returns True if the validator is registered and callable through `validate()`.
 */
export const isRegisteredValidator = (validatorName: string): validatorName is keyof typeof VALIDATOR_MAP => {
    return validatorName in VALIDATOR_MAP;
};

/**
 * Runs a named sub-validator, mutating the provided context.
 *
 * @param validatorName Name of the validator to use.
 * @param value String value to validate.
 * @param ctx Validation context to collect issues into.
 * @param platform Optional platform for platform-aware validators.
 *
 * @throws Error if the validator name is not recognized.
 */
export const validate = (validatorName: string, value: string, ctx: ValidationContext, platform?: Platform): void => {
    const validator = VALIDATOR_MAP[validatorName];

    if (!validator) {
        throw new Error(`Unknown validator: ${validatorName}`);
    }

    validator(value, ctx, platform);
};
