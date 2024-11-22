import { EmptyOrNegativeNumberOfRulesError } from './empty-or-negative-number-of-rules-error';
import { NegativeNumberOfRulesError } from './negative-number-of-rules-error';
import { ResourcesPathError } from './resources-path-error';

type ConverterOptionsError = EmptyOrNegativeNumberOfRulesError
| NegativeNumberOfRulesError
| ResourcesPathError;

export {
    type ConverterOptionsError,
    EmptyOrNegativeNumberOfRulesError,
    NegativeNumberOfRulesError,
    ResourcesPathError,
};
