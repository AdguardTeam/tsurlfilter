import { MaxScannedRulesError } from './max-scanned-rules-error';
import { TooManyError } from './too-many-error';
import { TooManyRegexpRulesError } from './too-many-regexp-rules-error';
import { TooManyRulesError } from './too-many-rules-error';
import { TooManyUnsafeRulesError } from './too-many-unsafe-rules-error';

export {
    MaxScannedRulesError,
    TooManyError,
    TooManyRegexpRulesError,
    TooManyRulesError,
    TooManyUnsafeRulesError,
};

/**
 * Union type of all limitation errors.
 *
 * @see {@link MaxScannedRulesError}
 * @see {@link TooManyError}
 * @see {@link TooManyRegexpRulesError}
 * @see {@link TooManyRulesError}
 * @see {@link TooManyUnsafeRulesError}
 */
export type LimitationError = MaxScannedRulesError
| TooManyError
| TooManyRegexpRulesError
| TooManyRulesError
| TooManyUnsafeRulesError;

/**
 * Type guard for {@link LimitationError}.
 *
 * @param error The error to check.
 *
 * @returns `true` if the error is a {@link LimitationError}, `false` otherwise.
 */
export function isLimitationError(error: unknown): error is LimitationError {
    return (
        error instanceof MaxScannedRulesError
        || error instanceof TooManyError
        || error instanceof TooManyRegexpRulesError
        || error instanceof TooManyRulesError
        || error instanceof TooManyUnsafeRulesError
    );
}
