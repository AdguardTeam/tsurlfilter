/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
/**
 * @file Input byte buffer for reading binary data.
 */

import { ByteBuffer } from './byte-buffer';
import { InputByteBuffer } from './input-byte-buffer';

/**
 * Input byte buffer for reading binary data.
 *
 * @note Internally, this class uses a {@link ByteBuffer} instance, just providing a convenient API for reading data.
 */
export class InputByteBuffer2 extends InputByteBuffer {
    /**
     * Reads a string from the buffer.
     *
     * @returns Decoded string from the buffer.
     */
    public readString(): string {
        // wrapped native decoder
        const [result, bytesConsumed] = this.byteBuffer.readString3(this.offset);
        this.offset += bytesConsumed;
        return result;
    }
}
