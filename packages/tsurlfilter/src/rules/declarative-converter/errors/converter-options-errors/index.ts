import { EmptyOrNegativeNumberOfRulesError } from './empty-or-negative-number-of-rules-error';
import { NegativeNumberOfRegexpRulesError } from './negative-number-of-regexp-rules-error';
import { ResourcesPathError } from './resources-path-error';

type ConverterOptionsError = EmptyOrNegativeNumberOfRulesError
| NegativeNumberOfRegexpRulesError
| ResourcesPathError;

export {
    type ConverterOptionsError,
    EmptyOrNegativeNumberOfRulesError,
    NegativeNumberOfRegexpRulesError,
    ResourcesPathError,
};
