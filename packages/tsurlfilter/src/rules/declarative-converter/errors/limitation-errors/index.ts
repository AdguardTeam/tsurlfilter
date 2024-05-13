import { TooManyRegexpRulesError } from './too-many-regexp-rules-error';
import { TooManyRulesError } from './too-many-rules-error';

type LimitationError = TooManyRegexpRulesError | TooManyRulesError;

export {
    type LimitationError,
    TooManyRegexpRulesError,
    TooManyRulesError,
};
