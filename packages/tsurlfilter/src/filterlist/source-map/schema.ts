import * as z from 'zod';

/**
 * Source map.
 *
 * @note Since serialized rule nodes are not store original rule text, we need this source map between the
 * serialized filter list and the raw filter list.
 */
export const filterListSourceMapValidator = z.record(
    /**
     * Rule start index in the converted list's byte buffer.
     */
    z.string(),

    /**
     * Rule start index in the raw converted list.
     */
    z.number(),
);

export type FilterListSourceMap = z.infer<typeof filterListSourceMapValidator>;
