import { MaxScannedRulesError } from './max-scanned-rules-error';
import { TooManyRegexpRulesError } from './too-many-regexp-rules-error';
import { TooManyUnsafeRulesError } from './too-many-unsafe-rules-error';
import { TooManyRulesError } from './too-many-rules-error';

type LimitationError = TooManyRegexpRulesError
| TooManyUnsafeRulesError
| TooManyRulesError
| MaxScannedRulesError;

export {
    type LimitationError,
    TooManyRegexpRulesError,
    TooManyUnsafeRulesError,
    TooManyRulesError,
    MaxScannedRulesError,
};
