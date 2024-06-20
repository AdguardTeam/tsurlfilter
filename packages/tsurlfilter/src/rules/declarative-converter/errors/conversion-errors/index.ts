import { EmptyResourcesError } from './empty-resources-error';
import { InvalidDeclarativeRuleError } from './invalid-declarative-rule-error';
import { UnsupportedModifierError } from './unsupported-modifier-error';
import { UnsupportedRegexpError } from './unsupported-regexp-error';

type ConversionError = UnsupportedModifierError
| EmptyResourcesError
| UnsupportedRegexpError;

export {
    type ConversionError,
    EmptyResourcesError,
    UnsupportedModifierError,
    UnsupportedRegexpError,
    InvalidDeclarativeRuleError,
};
