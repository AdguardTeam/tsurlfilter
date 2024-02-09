/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
/**
 * @file Input byte buffer for reading binary data.
 */

import { ByteBuffer } from './byte-buffer';
import { decodeText } from './text-decoder';

/**
 * Input byte buffer for reading binary data.
 *
 * @note Internally, this class uses a {@link ByteBuffer} instance, just providing a convenient API for reading data.
 */
export class InputByteBuffer {
    /**
     * ByteBuffer instance.
     */
    private byteBuffer: ByteBuffer;

    /**
     * Current offset in the buffer for reading.
     */
    private offset: number;

    /**
     * Constructs a new InputByteBuffer instance.
     *
     * @param chunks Array of chunks to initialize the ByteBuffer with.
     * @note Chunks are used by reference, not copied.
     */
    constructor(chunks: Uint8Array[]) {
        this.byteBuffer = new ByteBuffer(chunks);
        this.offset = 0;
    }

    /**
     * Reads a 8-bit unsigned integer from the buffer.
     *
     * @returns 8-bit unsigned integer from the buffer.
     */
    public readUint8(): number {
        const result = this.byteBuffer.readByte(this.offset) ?? 0;
        this.offset += 1;
        return result;
    }

    /**
     * Reads a 32-bit unsigned integer from the buffer.
     *
     * @returns 32-bit unsigned integer from the buffer.
     */
    public readUint32(): number {
        const result = (((this.byteBuffer.readByte(this.offset++) ?? 0) << 24)
            | ((this.byteBuffer.readByte(this.offset++) ?? 0) << 16)
            | ((this.byteBuffer.readByte(this.offset++) ?? 0) << 8)
            | ((this.byteBuffer.readByte(this.offset++) ?? 0))) >>> 0;
        return result;
    }

    /**
     * Reads a string from the buffer.
     *
     * @returns Decoded string from the buffer.
     */
    public readString(): string {
        const result = decodeText(this.byteBuffer, this.offset);
        this.offset += result.bytesConsumed;

        // Skip the null terminator
        if (this.byteBuffer.readByte(this.offset) === 0) {
            this.offset += 1;
        }

        return result.decodedText;
    }

    /**
     * Helper method for asserting the next 8-bit unsigned integer in the buffer.
     *
     * @param value Expected value.
     * @throws If the next value in the buffer is not equal to the expected value.
     */
    public assertUint8(value: number): void {
        if (this.readUint8() !== value) {
            throw new Error(`Expected ${value}, but got ${value}`);
        }
    }
}
