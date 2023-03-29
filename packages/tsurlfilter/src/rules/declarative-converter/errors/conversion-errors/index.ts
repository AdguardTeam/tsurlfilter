import { EmptyResourcesError } from './empty-resources-error';
import { InvalidDeclarativeRuleError } from './invalid-declarative-rule-error';
import { TooComplexRegexpError } from './too-complex-regexp-error';
import { UnsupportedModifierError } from './unsupported-modifier-error';
import { UnsupportedRegexpError } from './unsupported-regexp-error';

type ConversionError = TooComplexRegexpError
| UnsupportedModifierError
| EmptyResourcesError
| UnsupportedRegexpError;

export {
    ConversionError,
    EmptyResourcesError,
    TooComplexRegexpError,
    UnsupportedModifierError,
    UnsupportedRegexpError,
    InvalidDeclarativeRuleError,
};
