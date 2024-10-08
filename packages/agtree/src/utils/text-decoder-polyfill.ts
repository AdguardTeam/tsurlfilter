/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
/**
 * @file Optimized utility for decoding strings from byte sequences.
 */

import { EMPTY } from './constants';

const REPLACEMENT_CHAR = String.fromCodePoint(0xFFFD);

/**
 * Decodes a byte sequence into an UTF-8 string according to the WHATWG spec.
 * Optimized for performance.
 *
 * @param buffer Buffer to read the bytes from.
 * @param start Start offset in the buffer.
 * @param end End offset in the buffer.
 * @returns Decoded string.
 * @see {@link https://encoding.spec.whatwg.org/#utf-8-decoder}
 */
export const decodeTextPolyfill = (buffer: Uint8Array, start = 0, end = -1): string => {
    let codePoint = 0;
    let bytesSeen = 0;
    let bytesNeeded = 0;
    let lowerBoundary = 0x0080;
    let upperBoundary = 0x00BF;

    let i = start;
    const { length } = buffer;
    const realEnd = end === -1 ? length : Math.min(end, length);

    const result = new Array<string>(realEnd - start);
    let resIdx = 0;

    for (; i < realEnd; i += 1) {
        const byte = buffer[i];
        if (bytesNeeded === 0) {
            if (byte <= 0x007F) {
                codePoint = byte & 0x00FF;
            } else if (byte >= 0x00C2 && byte <= 0x00DF) {
                bytesNeeded = 1;
                codePoint = byte & 0x001F;
            } else if (byte >= 0x00E0 && byte <= 0x00EF) {
                bytesNeeded = 2;
                codePoint = byte & 0x000F;
                if (byte === 0x00E0) {
                    // Adjust lower boundary for exclusion of overlong sequences
                    lowerBoundary = 0x00A0;
                } else if (byte === 0x00ED) {
                    // Adjust upper boundary to exclude surrogates
                    upperBoundary = 0x009F;
                }
            } else if (byte >= 0x00F0 && byte <= 0x00F4) {
                bytesNeeded = 3;
                codePoint = byte & 0x0007;
                if (byte === 0x00F0) {
                    // Adjust lower boundary for exclusion of overlong sequences
                    lowerBoundary = 0x0090;
                } else if (byte === 0x00F4) {
                    // Adjust upper boundary to limit to valid Unicode range
                    upperBoundary = 0x008F;
                }
            } else {
                // For bytes that are not valid initial bytes of UTF-8 sequences, add replacement character
                result[resIdx++] = REPLACEMENT_CHAR;
                continue;
            }
        } else {
            // For subsequent bytes in a multibyte sequence, check if the byte is in the expected range
            if (!(byte >= lowerBoundary && byte <= upperBoundary)) {
                // Reset the state for illegal sequences and add replacement character
                bytesNeeded = 0;
                bytesSeen = 0;
                lowerBoundary = 0x0080;
                upperBoundary = 0x00BF;
                result[resIdx++] = REPLACEMENT_CHAR;
                // Decrement `i` to re-evaluate this byte as the start of a new sequence
                i -= 1;
                continue;
            }
            codePoint = (codePoint << 6) | (byte & 0x003F);
            // Reset boundaries for next bytes
            lowerBoundary = 0x0080;
            upperBoundary = 0x00BF;
            bytesSeen += 1;
        }

        if (bytesSeen === bytesNeeded) {
            // Complete the code point assembly and add it to the result
            result[resIdx++] = String.fromCodePoint(codePoint);
            // Reset for the next character
            bytesNeeded = 0;
            bytesSeen = 0;
            codePoint = 0;
        }
    }

    return result.join(EMPTY);
};
