import { type ConversionError } from './errors/conversion-errors';
import { type DeclarativeRule } from './declarative-rule';
import { type Source } from './source-map';
import { type LimitationError } from './errors/limitation-errors';

export type ConvertedRules = {
    sourceMapValues: Source[];
    declarativeRules: DeclarativeRule[];
    errors: (ConversionError | Error)[];
    limitations?: LimitationError[];
};
