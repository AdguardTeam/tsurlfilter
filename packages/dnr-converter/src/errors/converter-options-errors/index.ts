import { EmptyOrNegativeNumberOfRulesError } from './empty-or-negative-number-of-rules-error';
import { NegativeNumberOfRulesError } from './negative-number-of-rules-error';
import { ResourcesPathError } from './resources-path-error';

export {
    EmptyOrNegativeNumberOfRulesError,
    NegativeNumberOfRulesError,
    ResourcesPathError,
};

/**
 * Union type of converter options errors.
 *
 * @see {@link EmptyOrNegativeNumberOfRulesError}
 * @see {@link NegativeNumberOfRulesError}
 * @see {@link ResourcesPathError}
 */
export type ConverterOptionsError = EmptyOrNegativeNumberOfRulesError
| NegativeNumberOfRulesError
| ResourcesPathError;

/**
 * Type guard for {@link ConverterOptionsError}.
 *
 * @param error The error to check.
 *
 * @returns `true` if the error is a {@link ConverterOptionsError}, `false` otherwise.
 */
export function isConverterOptionsError(error: unknown): error is ConverterOptionsError {
    return (
        error instanceof EmptyOrNegativeNumberOfRulesError
        || error instanceof NegativeNumberOfRulesError
        || error instanceof ResourcesPathError
    );
}
