import { EmptyDomainsError } from './empty-domains-error';
import { EmptyResourcesError } from './empty-resources-error';
import { InvalidDeclarativeRuleError } from './invalid-declarative-rule-error';
import { UnsupportedModifierError } from './unsupported-modifier-error';
import { UnsupportedRegexpError } from './unsupported-regexp-error';

export {
    EmptyDomainsError,
    EmptyResourcesError,
    InvalidDeclarativeRuleError,
    UnsupportedModifierError,
    UnsupportedRegexpError,
};

/**
 * Union type of all conversion errors.
 *
 * @see {@link EmptyDomainsError}
 * @see {@link EmptyResourcesError}
 * @see {@link InvalidDeclarativeRuleError}
 * @see {@link UnsupportedModifierError}
 * @see {@link UnsupportedRegexpError}
 */
export type ConversionError = EmptyDomainsError
| EmptyResourcesError
| InvalidDeclarativeRuleError
| UnsupportedModifierError
| UnsupportedRegexpError;

/**
 * Type guard for {@link ConversionError}.
 *
 * @param error The error to check.
 *
 * @returns `true` if the error is a {@link ConversionError}, `false` otherwise.
 */
export function isConversionError(error: unknown): error is ConversionError {
    return (
        error instanceof EmptyDomainsError
        || error instanceof EmptyResourcesError
        || error instanceof InvalidDeclarativeRuleError
        || error instanceof UnsupportedModifierError
        || error instanceof UnsupportedRegexpError
    );
}
