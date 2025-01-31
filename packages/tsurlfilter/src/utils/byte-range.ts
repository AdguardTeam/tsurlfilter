import { jsonpos } from 'jsonpos';
import * as z from 'zod';
import { getUtf8EncodedLength } from './string-utils';

/**
 * Byte range validator.
 */
export const byteRangeValidator = z.object({
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
 * Get byte range for specific pointer path in the JSON.
 *
 * @param rawJson Raw JSON string.
 * @param pointerPath Pointer path.
 *
 * @returns Byte range for the specific pointer path.
 *
 * @throws Error if the pointer path is not found.
 */
export const getByteRangeFor = (rawJson: string, pointerPath: string): ByteRange => {
    const loc = jsonpos(rawJson, { pointerPath });

    if (!loc.start || !loc.end) {
        throw new Error(`Cannot find pointer name ${pointerPath}`);
    }

    const valueStart = loc.start.offset;
    const valueEnd = loc.end.offset;

    // Encode source before the data to get the correct start offset
    // Note: this is needed because binary data can be longer than the string representation
    const encodedLength = getUtf8EncodedLength(rawJson.slice(0, valueStart));

    const startByteOffset = encodedLength;

    // Now encode the data itself to get the correct end offset
    const data = rawJson.slice(valueStart, valueEnd);
    const dataEncodedLength = getUtf8EncodedLength(data);

    const endByteOffset = startByteOffset + dataEncodedLength - 1;

    return { start: startByteOffset, end: endByteOffset };
};
