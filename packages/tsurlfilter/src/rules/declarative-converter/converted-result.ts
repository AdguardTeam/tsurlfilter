import { type DeclarativeRule } from './declarative-rule';
import { type ConversionError } from './errors/conversion-errors';
import { type LimitationError } from './errors/limitation-errors';
import { type Source } from './source-map';

export type ConvertedRules = {
    sourceMapValues: Source[];
    declarativeRules: DeclarativeRule[];
    errors: (ConversionError | Error)[];
    limitations?: LimitationError[];
};
