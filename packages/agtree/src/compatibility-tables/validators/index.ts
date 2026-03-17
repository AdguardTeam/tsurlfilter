/**
 * @file Validators for modifier value formats.
 */

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
 * Map of validator names to their validation functions.
 */
const VALIDATOR_MAP: Record<string, ValidatorFn> = Object.fromEntries(
    VALIDATORS.map((validator) => [validator.name, validator.validate]),
);

/**
 * Set of known validator names.
 * Derived from VALIDATORS - these validators don't need to be validated as regex patterns.
 */
export const KNOWN_VALIDATORS: ReadonlySet<string> = new Set(VALIDATORS.map((v) => v.name));

/**
 * Checks if the given validator name is a known validator.
 *
 * @param validatorName Name of the validator to check.
 *
 * @returns True if the validator name is a known validator, false otherwise.
 */
export const isKnownValidator = (validatorName: string): validatorName is keyof typeof VALIDATOR_MAP => {
    return KNOWN_VALIDATORS.has(validatorName);
};

/**
 * Runs a named sub-validator, mutating the provided context.
 *
 * @param validatorName Name of the validator to use.
 * @param value String value to validate.
 * @param ctx Validation context to collect issues into.
 *
 * @throws Error if the validator name is not recognized.
 */
export const validate = (validatorName: string, value: string, ctx: ValidationContext): void => {
    const validator = VALIDATOR_MAP[validatorName];

    if (!validator) {
        throw new Error(`Unknown validator: ${validatorName}`);
    }

    validator(value, ctx);
};
