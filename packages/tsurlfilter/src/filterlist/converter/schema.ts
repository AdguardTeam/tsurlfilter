import { z } from 'zod';
import { filterListSourceMapValidator } from '../source-map/schema';

/**
 * Map of converted rules to original rules.
 *
 * @note This is only needed to show the original rule text in the filtering log if a converted rule is applied.
 */
export const filterListConversionMapValidator = z.record(
    /**
     * Converted rule text.
     */
    z.string(),

    /**
     * Original rule text.
     */
    z.string(),
);

export type FilterListConversionMap = z.infer<typeof filterListConversionMapValidator>;

/**
 * Filter list conversion result.
 */
export const convertedFilterListValidator = z.object({
    /**
     * Converted filter list.
     */
    convertedFilterList: z.string(),

    /**
     * Map of converted rules to original rules.
     */
    conversionMap: filterListConversionMapValidator,

    /**
     * Source map.
     */
    sourceMap: filterListSourceMapValidator,
});

export type ConvertedFilterList = z.infer<typeof convertedFilterListValidator>;
