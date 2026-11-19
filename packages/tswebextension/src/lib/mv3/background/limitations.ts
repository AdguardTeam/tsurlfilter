import { type LimitationError, TooManyError } from '@adguard/dnr-converter';

/**
 * Creates an error of the same class with cumulative counters.
 *
 * The message of the first error is kept: it describes the overflow which was
 * detected first, while the counters describe the whole configuration. The
 * message is not parsed by consumers, they read the counters.
 *
 * @param first Error to merge into.
 * @param other Error to merge.
 *
 * @returns Merged error.
 */
const mergeTwo = (first: TooManyError, other: TooManyError): TooManyError => {
    const Constructor = first.constructor as new (
        message: string,
        excludedRulesIds: number[],
        numberOfMaximumRules: number,
        numberOfExcludedDeclarativeRules: number,
    ) => TooManyError;

    return new Constructor(
        first.message,
        first.excludedRulesIds.concat(other.excludedRulesIds),
        first.numberOfMaximumRules,
        first.numberOfExcludedDeclarativeRules + other.numberOfExcludedDeclarativeRules,
    );
};

/**
 * Merges limitation errors of the same class into one.
 *
 * Both the regular and the CSP conversion report their own overflow of the same
 * browser quota, so a configuration which overflows in both passes ends up with
 * two errors of one class. Consumers take the first matching error, so the
 * second one is lost. Errors of one class are merged into a single one with
 * concatenated source rule ids and summed counters.
 *
 * @param limitations Limitation errors to merge.
 *
 * @returns Limitations with one error per class.
 */
export const mergeLimitations = (limitations: LimitationError[]): LimitationError[] => {
    const result: LimitationError[] = [];
    const indexByClass = new Map<unknown, number>();

    limitations.forEach((limitation) => {
        if (!(limitation instanceof TooManyError)) {
            result.push(limitation);

            return;
        }

        const index = indexByClass.get(limitation.constructor);
        if (index === undefined) {
            indexByClass.set(limitation.constructor, result.length);
            result.push(limitation);

            return;
        }

        result[index] = mergeTwo(result[index] as TooManyError, limitation);
    });

    return result;
};
