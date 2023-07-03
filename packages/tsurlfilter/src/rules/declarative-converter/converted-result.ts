import { ConversionError } from './errors/conversion-errors';
import { DeclarativeRule } from './declarative-rule';
import { Source } from './source-map';
import { LimitationError } from './errors/limitation-errors';

export type ConvertedRules = {
    sourceMapValues: Source[],
    declarativeRules: DeclarativeRule[],
    errors: (ConversionError | Error)[],
    limitations?: LimitationError[],
};
