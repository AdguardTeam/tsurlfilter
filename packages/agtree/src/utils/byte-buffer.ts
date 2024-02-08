/* eslint-disable no-bitwise */
import { ByteBufferCore } from './byte-buffer-core';
import { decode } from './text-decoder';
import { encode } from './text-encoder';

/**
 * A ByteBuffer class for handling binary data in chunks.
 * This class allows for efficient byte storage and manipulation by organizing data into chunks
 * and providing methods to read and write bytes.
 */
export class ByteBuffer extends ByteBufferCore {
    /**
     * Writes a 32-bit unsigned integer to the buffer.
     *
     * @param value Value to write.
     * @returns Number of bytes written to the buffer.
     */
    public writeUint32(value: number): number {
        this.writeByte(value >> 24);
        this.writeByte(value >> 16);
        this.writeByte(value >> 8);
        this.writeByte(value);
        return 4;
    }

    /**
     * Reads a 32-bit unsigned integer from the buffer.
     *
     * @param position Position in the buffer to read from.
     * @returns 32-bit unsigned integer from the buffer.
     */
    public readUint32(position: number): number {
        return (((this.readByte(position) ?? 0) << 24)
            | ((this.readByte(position + 1) ?? 0) << 16)
            | ((this.readByte(position + 2) ?? 0) << 8)
            | ((this.readByte(position + 3) ?? 0))) >>> 0;
    }

    /**
     * Writes a 8-bit unsigned integer to the buffer.
     *
     * @param value Value to write.
     * @returns Number of bytes written to the buffer.
     */
    public writeUint8(value: number): number {
        this.writeByte(value);
        return 1;
    }

    /**
     * Reads a 8-bit unsigned integer from the buffer.
     *
     * @param position Position in the buffer to read from.
     * @returns 8-bit unsigned integer from the buffer.
     */
    public readUint8(position: number): number {
        return this.readByte(position) ?? 0;
    }

    /**
     * Writes a string to the buffer.
     *
     * @param value Value to write.
     * @returns Number of bytes written to the buffer.
     */
    public writeString(value: string): number {
        return encode(this, value);
    }

    /**
     * Reads a string from the buffer.
     *
     * @param position Position in the buffer to read from.
     * @param length Length of the byte sequence to decode.
     * @returns Decoded string from the buffer.
     */
    public readString(position: number, length: number): string {
        return decode(this, position, length);
    }
}
