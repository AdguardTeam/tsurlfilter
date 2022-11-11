import { ConversionError } from './errors/conversion-errors';
import { LimitationError } from './errors/limitation-errors';
import { IRuleSet } from './rule-set';

/**
 * The result of the conversion contains a list of rule sets with all the
 * information about the declarative rules, errors that may have occurred
 * during the conversion and limitations if some of them have been applied.
 */
export interface ConversionResult {
    ruleSets: IRuleSet[],
    errors: (ConversionError | Error)[],
    limitations: LimitationError[],
}
