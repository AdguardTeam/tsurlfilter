import { z } from 'zod';
import { filterListSourceMapValidator } from '../source-map/schema';

/**
 * Map of converted rules to original rules.
 *
 * @note This is only needed to show the original rule text in the filtering log if a converted rule is applied.
 */
export const filterListConversionMapValidator = z.record(
    /**
     * Converted rule line start offset.
     */
    z.number(),

    /**
     * Original rule text.
     */
    z.string(),
);

export type FilterListConversionMap = z.infer<typeof filterListConversionMapValidator>;

/**
 * Filter list conversion result.
 */
export const preprocessedFilterListValidator = z.object({
    /**
     * Raw processed filter list.
     */
    rawFilterList: z.string(),

    /**
     * Processed filter list, but in a serialized form.
     */
    filterList: z.array(z.instanceof(Uint8Array)),

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
