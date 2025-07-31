import * as z from 'zod';

import { filterListSourceMapValidator } from '../source-map/schema';

/**
 * Validator for filter list conversion map.
 *
 * @note This is only needed to show the original rule text in the filtering log if a converted rule is applied.
 */
export const filterListConversionMapValidator = z.record(
    /**
     * Converted rule line start offset.
     */
    z.string(),

    /**
     * Original rule text.
     */
    z.string(),
);

export type FilterListConversionMap = z.infer<typeof filterListConversionMapValidator>;

/**
 * Validator for filter list chunks.
 */
export const filterListChunksValidator = z.array(z.custom<Uint8Array>((val) => val instanceof Uint8Array));

/**
 * Validator for preprocessed filter list.
 */
export const preprocessedFilterListValidator = z.object({
    /**
     * Raw processed filter list.
     */
    rawFilterList: z.string(),

    /**
     * Processed filter list, but in a serialized form.
     */
    filterList: filterListChunksValidator,

    /**
     * Map of converted rules to original rules.
     */
    conversionMap: filterListConversionMapValidator,

    /**
     * Source map.
     */
    sourceMap: filterListSourceMapValidator,
});

export type PreprocessedFilterList = z.infer<typeof preprocessedFilterListValidator>;
