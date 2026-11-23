import { EmptyDomainsError } from './empty-domains-error';
import { EmptyResourcesError } from './empty-resources-error';
import { InvalidDeclarativeRuleError } from './invalid-declarative-rule-error';
import { UnexpectedConversionError } from './unexpected-conversion-error';
import { UnsupportedModifierError } from './unsupported-modifier-error';
import { UnsupportedRegexpError } from './unsupported-regexp-error';

export {
    EmptyDomainsError,
    EmptyResourcesError,
    InvalidDeclarativeRuleError,
    UnexpectedConversionError,
    UnsupportedModifierError,
    UnsupportedRegexpError,
};

/**
 * Union type of all conversion errors.
 *
 * Every error of this union describes a source rule which could not be
 * converted, so the rule is always available via the `rule` field.
 *
 * @see {@link EmptyDomainsError}
 * @see {@link EmptyResourcesError}
 * @see {@link InvalidDeclarativeRuleError}
 * @see {@link UnexpectedConversionError}
 * @see {@link UnsupportedModifierError}
 * @see {@link UnsupportedRegexpError}
 */
export type ConversionError = EmptyDomainsError
| EmptyResourcesError
| InvalidDeclarativeRuleError
| UnexpectedConversionError
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
        || error instanceof UnexpectedConversionError
        || error instanceof UnsupportedModifierError
        || error instanceof UnsupportedRegexpError
    );
}
