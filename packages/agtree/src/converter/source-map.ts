/**
 * @file Serializable source map linking converted filter-list lines back to
 * their original rule text. Structurally identical to the legacy
 * tsurlfilter `ConversionData` so persisted data keeps validating.
 */

import { z as zod } from 'zod';

/**
 * Non-negative integer that may arrive as a string (JSON numeric object keys)
 * or a number.
 */
const nonNegativeIntegerSchema = zod.union([zod.string(), zod.number()])
    .pipe(zod.coerce.number())
    .refine((num) => Number.isInteger(num) && num >= 0, {
        message: 'Must be a non-negative integer',
    });

/**
 * Validates the shape of a persisted source map: the `originals` array and the
 * `conversions` offset map. It checks structure only — reversing a conversion
 * and reverse lookups live on {@link FilterListConversionResult}.
 */
export const conversionSourceMapValidator = zod.object({
    /**
     * Original text of every rule that was converted, in insertion order.
     */
    originals: zod.string().array(),

    /**
     * Maps a converted-line start offset (0-based) to an index in `originals`.
     *
     * The indices are trusted converter output: the validator checks the shape,
     * not that an index falls within `originals`. Maps produced outside the
     * converter must be validated at their input boundary.
     */
    conversions: zod.record(nonNegativeIntegerSchema, zod.number()),
});

/**
 * Serializable map from converted output back to original rule text.
 */
export type ConversionSourceMap = zod.infer<typeof conversionSourceMapValidator>;

/**
 * Creates an empty source map.
 *
 * @returns Empty source map.
 */
export function createEmptyConversionSourceMap(): ConversionSourceMap {
    return { originals: [], conversions: {} };
}
