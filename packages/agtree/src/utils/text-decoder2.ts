/* eslint-disable no-bitwise */
/**
 * @file Utility for decoding strings from byte sequences.
 */

import { type ByteBuffer } from './byte-buffer';

/**
 * Result of a decoder operation.
 */
export interface DecoderResult {
    decodedText: string;
    bytesConsumed: number;
}

const BUFFER = new Uint8Array(16 * 1024);
const DECODER = new TextDecoder();

/**
 * Decodes a byte sequence into an UTF-8 string according to the WHATWG spec.
 *
 * @param buffer Buffer to read the bytes from. See {@link ByteBuffer}.
 * @param start Start index of the byte sequence within the buffer.
 * @returns Decoded string.
 * @see {@link https://encoding.spec.whatwg.org/#utf-8-decoder}
 * @note Bytes written maybe larger than the string length, but never smaller.
 * For example, the string '你好' has a length of 2, but its byte representation has a length of 6.
 */
export const decodeText2 = (buffer: ByteBuffer, start: number): DecoderResult => {
    let i = 0;
    for (let byte = buffer.readByte(i); byte; byte = buffer.readByte(i)) {
        BUFFER[i] = byte;
        i += 1;
    }

    return {
        decodedText: DECODER.decode(BUFFER.subarray(0, i)),
        bytesConsumed: i - start,
    };
};
