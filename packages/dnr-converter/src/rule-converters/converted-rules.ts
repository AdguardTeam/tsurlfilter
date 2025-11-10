import { type DeclarativeRule } from '../declarative-rule';
import { type ConversionError } from '../errors/conversion-errors';
import { type LimitationError } from '../errors/limitation-errors';
import { type Source } from '../source-map';

/**
 * Interface that contains converted rules along with source map values, errors, and limitations.
 */
export interface ConvertedRules {
    /**
     * Mapping of source rules to converted original filter rules and declarative rules.
     */
    sourceMapValues: Source[];

    /**
     * Converted declarative rules.
     */
    declarativeRules: DeclarativeRule[];

    /**
     * List of errors occurred during conversion.
     */
    errors: (ConversionError | Error)[];

    /**
     * List of limitations occurred during conversion.
     */
    limitations?: LimitationError[];
}
