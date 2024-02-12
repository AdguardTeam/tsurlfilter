/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
/**
 * @file Output byte buffer for writing binary data.
 */

import { ByteBuffer } from './byte-buffer';
import { type Storage } from './storage-interface';
import { encodeText } from './text-encoder';

/**
 * Output byte buffer for writing binary data.
 *
 * @note Internally, this class uses a {@link ByteBuffer} instance, just providing a convenient API for reading data.
 */
export class OutputByteBuffer {
    /**
     * ByteBuffer instance.
     */
    private byteBuffer: ByteBuffer;

    /**
     * Current offset in the buffer for writing.
     */
    private offset: number;

    /**
     * Constructs a new OutputByteBuffer instance.
     */
    // TODO: add chunks as a parameter, if ever needed
    constructor() {
        this.byteBuffer = new ByteBuffer();
        this.offset = 0;
    }

    /**
     * Writes a 8-bit unsigned integer to the buffer.
     *
     * @param value Value to write.
     * @returns Number of bytes written to the buffer.
     */
    public writeUint8(value: number): number {
        this.byteBuffer.writeByte(this.offset++, value);
        return 1;
    }

    /**
     * Writes a 16-bit unsigned integer to the buffer.
     *
     * @param value Value to write.
     * @returns Number of bytes written to the buffer.
     */
    public writeUint16(value: number): number {
        this.byteBuffer.writeByte(this.offset++, value >> 8);
        this.byteBuffer.writeByte(this.offset++, value);
        return 2;
    }

    /**
     * Writes a 32-bit unsigned integer to the buffer.
     *
     * @param value Value to write.
     * @returns Number of bytes written to the buffer.
     */
    public writeUint32(value: number): number {
        this.byteBuffer.writeByte(this.offset++, value >> 24);
        this.byteBuffer.writeByte(this.offset++, value >> 16);
        this.byteBuffer.writeByte(this.offset++, value >> 8);
        this.byteBuffer.writeByte(this.offset++, value);
        return 4;
    }

    /**
     * Writes a string to the buffer.
     *
     * @param value Value to write.
     * @returns Number of bytes written to the buffer.
     */
    public writeString(value: string): number {
        const bytesWritten = encodeText(value, this.byteBuffer, this.offset);
        this.offset += bytesWritten;
        return bytesWritten;
    }

    /**
     * Writes chunks to the storage.
     *
     * @param storage Storage to write the chunks to.
     * @param key Key to write the chunks to.
     * @note For performance reasons, chunks are passed by reference and not copied.
     * @throws If the storage write operation throws.
     */
    public async writeChunksToStorage(storage: Storage, key: string): Promise<void> {
        await this.byteBuffer.writeChunksToStorage(storage, key);
    }
}
