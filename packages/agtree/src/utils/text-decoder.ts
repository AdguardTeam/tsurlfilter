/* eslint-disable no-bitwise */
/**
 * @file Utility for decoding strings from byte sequences.
 */
import { type ByteBufferCore } from './byte-buffer-core';
import { EMPTY } from './constants';

const REPLACEMENT_CHAR = String.fromCodePoint(0xFFFD);

/**
 * Decodes a byte sequence into an UTF-8 string according to the WHATWG spec.
 *
 * @param buffer Buffer to read the bytes from. See {@link ByteBufferCore}.
 * @param start Start index of the byte sequence within the buffer.
 * @param length Length of the byte sequence to decode.
 * @returns Decoded string.
 * @see {@link https://encoding.spec.whatwg.org/#utf-8-decoder}
 * @note Bytes written maybe larger than the string length, but never smaller.
 * For example, the string '你好' has a length of 2, but its byte representation has a length of 6.
 */
export const decode = (buffer: ByteBufferCore, start: number, length: number): string => {
    let result = EMPTY;
    const end = start + length;
    let i = start;

    let codePoint = 0;
    let bytesSeen = 0;
    let bytesNeeded = 0;
    let lowerBoundary = 0x0080;
    let upperBoundary = 0x00BF;

    while (i < end) {
        const byte = buffer.readByte(i) ?? 0;
        i += 1;
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
                result += REPLACEMENT_CHAR;
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
                result += REPLACEMENT_CHAR;
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
            result += String.fromCodePoint(codePoint);
            // Reset for the next character
            bytesNeeded = 0;
            bytesSeen = 0;
            codePoint = 0;
        }
    }

    return result;
};
