/* eslint-disable no-bitwise */
/**
 * @file Utility for encoding strings to byte sequences.
 */
import { type ByteBuffer } from './byte-buffer';

/**
 * Checks if the given code point is an ASCII code point.
 *
 * @param codePoint Code point to check
 * @returns `true` if the given code point is an ASCII code point, `false` otherwise.
 * @see https://infra.spec.whatwg.org/#ascii-code-point
 */
const isAsciiCodePoint = (codePoint: number): boolean => {
    return codePoint >= 0x0000 && codePoint <= 0x007F;
};

/**
 * Encodes an UTF-8 string into a byte sequence according to the WHATWG spec.
 *
 * @param str String to encode
 * @param buffer ByteBuffer to write the encoded bytes to
 * @see {@link https://encoding.spec.whatwg.org/#utf-8-encoder}
 * @returns The number of bytes written to the buffer.
 * @note Bytes written maybe larger than the string length, but never smaller.
 * For example, the string '你好' has a length of 2, but its byte representation has a length of 6.
 */
export const encode = (str: string, buffer: ByteBuffer): number => {
    let bytesWritten = 0;
    let i = 0;

    while (i < str.length) {
        const codePoint = str.codePointAt(i) || 0;

        // Handle ASCII code points directly.
        if (isAsciiCodePoint(codePoint)) {
            buffer.pushByte(codePoint);
            bytesWritten += 1;
            i += 1;
            continue;
        }

        let count = 0;
        let offset = 0;

        // Determine count and offset based on code point range.
        if (codePoint >= 0x0080 && codePoint <= 0x07FF) {
            count = 1;
            offset = 0x00C0;
        } else if (codePoint >= 0x0800 && codePoint <= 0xFFFF) {
            count = 2;
            offset = 0x00E0;
        } else if (codePoint >= 0x10000 && codePoint <= 0x10FFFF) {
            count = 3;
            offset = 0x00F0;
        }

        // Prepare the first byte.
        buffer.pushByte((codePoint >> (6 * count)) + offset);
        bytesWritten += 1;

        // Append subsequent bytes.
        while (count > 0) {
            buffer.pushByte(0x0080 | ((codePoint >> (6 * (count - 1))) & 0x003F));
            bytesWritten += 1;
            count -= 1;
        }

        // Increment `i` by 1 for characters in the BMP or by 2 for characters outside the BMP.
        i += codePoint >= 0x10000 ? 2 : 1;
    }

    return bytesWritten;
};
