/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
/**
 * @file Input byte buffer for reading binary data.
 */

import { ByteBuffer } from './byte-buffer';
import { isArrayOfUint8Arrays } from './type-guards';
import { type Storage } from './storage-interface';
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
     * @note If you provide chunks, for performance reasons, they are passed by reference and not copied.
     */
    constructor(chunks: Uint8Array[]) {
        this.byteBuffer = new ByteBuffer(chunks);
        this.offset = 0;
    }

    /**
     * Creates a new InputByteBuffer instance from a Storage instance by reading chunks from the storage.
     *
     * @param storage Storage instance.
     * @param key Key to read from the storage.
     * @returns New InputByteBuffer instance.
     * @note For performance reasons, chunks are passed by reference and not copied.
     */
    public static async createFromStorage(storage: Storage, key: string): Promise<InputByteBuffer> {
        const chunks = await storage.read(key);

        // FIXME
        if (!isArrayOfUint8Arrays(chunks)) {
            throw new Error('The data from storage is not an array of Uint8Arrays');
        }

        return new InputByteBuffer(chunks);
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
     * Reads a 16-bit unsigned integer from the buffer.
     *
     * @returns 16-bit unsigned integer from the buffer.
     */
    public readUint16(): number {
        const result = (((this.byteBuffer.readByte(this.offset++) ?? 0) << 8)
            | ((this.byteBuffer.readByte(this.offset++) ?? 0))) >>> 0;
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
     * Looks ahead and reads a 8-bit unsigned integer from the buffer, without advancing the offset.
     *
     * @returns 8-bit unsigned integer from the buffer.
     */
    public lookaheadUint8(): number {
        return this.byteBuffer.readByte(this.offset) ?? 0;
    }

    /**
     * Reads a string from the buffer.
     *
     * @returns Decoded string from the buffer.
     */
    public readString(): string {
        const result = decodeText(this.byteBuffer, this.offset);
        this.offset += result.bytesConsumed;
        return result.decodedText;
    }

    /**
     * Helper method for asserting the next 8-bit unsigned integer in the buffer.
     *
     * @param value Expected value.
     * @throws If the next value in the buffer is not equal to the expected value.
     */
    public assertUint8(value: number): void {
        const result = this.readUint8();
        if (result !== value) {
            throw new Error(`Expected ${value}, but got ${result}`);
        }
    }
}
