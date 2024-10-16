import { EmptyOrNegativeNumberOfRulesError } from './empty-or-negative-number-of-rules-error';
import { NegativeNumberOfRulesError } from './negative-number-of-regexp-rules-error';
import { ResourcesPathError } from './resources-path-error';
import { NonRequiredMaxUnsafeRulesNumberError } from './non-required-max-unsafe-rules-number-error';

type ConverterOptionsError = EmptyOrNegativeNumberOfRulesError
| NegativeNumberOfRulesError
| NonRequiredMaxUnsafeRulesNumberError
| ResourcesPathError;

export {
    type ConverterOptionsError,
    EmptyOrNegativeNumberOfRulesError,
    NegativeNumberOfRulesError,
    NonRequiredMaxUnsafeRulesNumberError,
    ResourcesPathError,
};
