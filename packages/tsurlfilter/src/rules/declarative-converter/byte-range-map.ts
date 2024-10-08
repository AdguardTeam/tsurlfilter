import { z } from 'zod';

import { fetchExtensionResourceText } from '../../utils/resource-fetch';
import { isNonEmptyArray } from '../../utils/guards';

/**
 * Byte range validator.
 */
const byteRangeValidator = z.object({
    /**
     * Start of the byte range.
     */
    start: z.number(),

    /**
     * End of the byte range.
     */
    end: z.number(),
});

/**
 * Byte range.
 */
export type ByteRange = z.infer<typeof byteRangeValidator>;

/**
 * Byte range map validator.
 */
const byteRangeMapValidator = z.record(byteRangeValidator);

/**
 * Byte range map.
 */
export type ByteRangeMap = z.infer<typeof byteRangeMapValidator>;

/**
 * Byte range map collection validator.
 */
const byteRangeMapCollectionValidator = z.record(byteRangeMapValidator);

/**
 * Byte range map collection.
 */
export type ByteRangeMapCollection = z.infer<typeof byteRangeMapCollectionValidator>;

/**
 * Byte range map collection rule validator.
 *
 * @note We use `passthrough` because other fields are irrelevant.
 */
const byteRangeMapCollectionRuleValidator = z.object({
    byteRangeMapsCollection: byteRangeMapCollectionValidator,
}).passthrough();

/**
 * Deserialize a byte range map from a string.
 *
 * @param rawJson Serialized byte range map.
 *
 * @returns Deserialized byte range maps as a Record.
 *
 * @throws Error if the input is invalid.
 */
export function deserializeByteRangeMaps(rawJson: string): ByteRangeMapCollection {
    const parsedArray = JSON.parse(rawJson);

    if (!isNonEmptyArray(parsedArray)) {
        throw new Error('Invalid input: expected a non-empty array.');
    }

    // Validate only the first object in the array
    const parsedFirstElement = byteRangeMapCollectionRuleValidator.parse(parsedArray[0]);
    return parsedFirstElement.byteRangeMapsCollection;
}

/**
 * Fetch byte range maps from a file, deserialize, and return them.
 *
 * @param filePath Path to the file containing serialized byte range maps.
 * @returns Deserialized byte range maps.
 * @throws Error if the file is not found or the content is invalid.
 */
export async function fetchAndDeserializeByteRangeMaps(filePath: string): Promise<ByteRangeMapCollection> {
    const rawJson = await fetchExtensionResourceText(filePath);
    return deserializeByteRangeMaps(rawJson);
}
