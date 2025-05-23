/* eslint-disable no-param-reassign */
/* eslint-disable no-bitwise */
/**
 * @file Utility for encoding strings to byte sequences.
 */

export interface TextEncoderPolyfillResult {
    readonly written: number;
    readonly read: number;
}

/**
 * Checks if the given code point is an ASCII code point.
 *
 * @param codePoint Code point to check.
 * @returns `true` if the given code point is an ASCII code point, `false` otherwise.
 * @see {@link https://infra.spec.whatwg.org/#ascii-code-point}
 */
const isAsciiCodePoint = (codePoint: number): boolean => {
    return codePoint >= 0x0000 && codePoint <= 0x007F;
};

const OFFSETS = [0xC0, 0xE0, 0xF0];

/**
 * Encodes an UTF-8 string into a byte sequence according to the WHATWG spec.
 *
 * @param str String to encode.
 * @param buffer Buffer to write the encoded bytes to.
 * @returns Number of bytes written to the buffer.
 * @see {@link https://encoding.spec.whatwg.org/#utf-8-encoder}
 * @note Bytes written maybe larger than the string length, but never smaller.
 * For example, the string '你好' has a length of 2, but its byte representation has a length of 6.
 */
export const encodeIntoPolyfill = (str: string, buffer: Uint8Array): TextEncoderPolyfillResult => {
    const { length } = buffer;
    let read = 0;
    let written = 0;

    for (let i = 0; i < str.length;) {
        const codePoint = str.codePointAt(i) || 0;
        let bytesNeeded = 1;

        if (isAsciiCodePoint(codePoint)) {
            if (written >= length) break; // Stop if no space in buffer
            buffer[written] = codePoint;
            written += 1;
            read += 1; // Increment read for ASCII
            i += 1;
        } else {
            if (codePoint >= 0x0080 && codePoint <= 0x07FF) {
                bytesNeeded = 2;
            } else if (codePoint >= 0x0800 && codePoint <= 0xFFFF) {
                bytesNeeded = 3;
            } else if (codePoint >= 0x10000 && codePoint <= 0x10FFFF) {
                bytesNeeded = 4;
            }

            if (written + bytesNeeded - 1 >= length) {
                // Stop if no space for the whole encoding
                break;
            }

            let count = bytesNeeded - 1;
            const offset = OFFSETS[bytesNeeded - 2];

            buffer[written] = (codePoint >> (6 * count)) + offset;
            written += 1;

            while (count > 0) {
                buffer[written] = 0x80 | ((codePoint >> (6 * (count - 1))) & 0x3F);
                written += 1;
                count -= 1;
            }

            read += codePoint >= 0x10000 ? 2 : 1; // Increment read by 1 or 2 depending on code point
            i += codePoint >= 0x10000 ? 2 : 1; // Move i by 1 or 2
        }
    }

    return { read, written };
};
