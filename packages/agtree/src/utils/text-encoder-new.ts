import { type ByteBuffer } from './byte-buffer';

const BUFFER = new Uint8Array(64 * 1024);
const ENCODER = new TextEncoder();

/**
 * Encodes an UTF-8 string into a byte sequence according to the WHATWG spec.
 *
 * @param str String to encode.
 * @param buffer Buffer to write the encoded bytes to. See {@link ByteBuffer}.
 * @param start Start index of the byte sequence within the buffer.
 * @returns Number of bytes written to the buffer.
 * @see {@link https://encoding.spec.whatwg.org/#utf-8-encoder}
 * @note Bytes written maybe larger than the string length, but never smaller.
 * For example, the string '你好' has a length of 2, but its byte representation has a length of 6.
 */
export const encodeTextNew = (str: string, buffer: ByteBuffer, start: number): number => {
    const result = ENCODER.encodeInto(str, BUFFER);

    if (result.read !== str.length) {
        // TODO: Rework this. Use the first bit to indicate if the length takes
        // 1, 2, 3 or 4 bytes:
        // https://chat.openai.com/share/36c69a58-d004-43eb-a3e7-e98b3787bb5c
        //
        // In this case you can use a smaller buffer (8kb should be enough), but
        // read a much longer string.

        throw new Error('The string is too large, do not allow ');
    }

    // Write the length first.
    let position = start;

    if (result.written < 128) {
        buffer.writeByte(position, result.written);
        position += 1;
    } else if (result.written < 16384) {
        // eslint-disable-next-line no-bitwise
        buffer.writeByte(position, 128 | (result.written >> 8));
        position += 1;
        // eslint-disable-next-line no-bitwise
        buffer.writeByte(position, result.written & 0xFF);
        position += 1;
    } else {
        throw new Error('The string is too large, do not allow ');
    }

    // TODO: Rework this, provide a "write" function that uses "Uint8Array.set"
    // to write buffer directly.
    for (let i = 0; i < result.written; i += 1) {
        buffer.writeByte(position, BUFFER[i]);
        position += 1;
    }

    return result.written;
};
