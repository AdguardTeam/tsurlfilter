import { MaxScannedRulesError } from './max-scanned-rules-error';
import { TooManyRegexpRulesError } from './too-many-regexp-rules-error';
import { TooManyRulesError } from './too-many-rules-error';

type LimitationError = TooManyRegexpRulesError | TooManyRulesError | MaxScannedRulesError;

export {
    type LimitationError,
    TooManyRegexpRulesError,
    TooManyRulesError,
    MaxScannedRulesError,
};
