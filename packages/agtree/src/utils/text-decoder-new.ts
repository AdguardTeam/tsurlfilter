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
export const decodeTextNew = (buffer: ByteBuffer, start: number): DecoderResult => {
    // TODO: !!! DIRTY, REWORK THIS

    let position = start;

    // Decode string length first.
    const highByte = buffer.readByte(position) || 0;
    position += 1;
    const lowByte = buffer.readByte(position) || 0;
    position += 1;
    // eslint-disable-next-line no-bitwise
    const bytesToRead = (highByte << 8) | lowByte;

    // Re-use the existing buffer, it should fit 99.9999% of all strings.
    let buf = BUFFER;

    if (bytesToRead > BUFFER.length) {
        // This is an allocation that we could avoid, but we assume that there
        // are almost no strings that long in our case.
        buf = new Uint8Array(bytesToRead);
    }

    // TODO: DIRTY, You need to read until you read FULL buffer or bytesToRead.
    buffer.read(position, buf);

    return {
        decodedText: DECODER.decode(buf.subarray(0, bytesToRead)),
        bytesConsumed: bytesToRead,
    };
};
