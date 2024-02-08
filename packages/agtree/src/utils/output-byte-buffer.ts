/* eslint-disable no-bitwise */
import { type ByteBuffer } from './byte-buffer';
import { encode } from './text-encoder';

/**
 * Output byte buffer for writing binary data from left to right.
 */
export class OutputByteBuffer {
    /**
     * ByteBuffer instance.
     */
    private byteBuffer: ByteBuffer;

    /**
     * Constructs a new OutputByteBuffer instance.
     *
     * @param buffer ByteBuffer for writing binary data.
     */
    constructor(buffer: ByteBuffer) {
        this.byteBuffer = buffer;
    }

    /**
     * Returns the current offset in the buffer for reading.
     *
     * @returns The current offset in the buffer.
     */
    public get byteOffset(): number {
        return this.byteBuffer.byteOffset;
    }

    /**
     * Writes a 8-bit unsigned integer to the buffer.
     *
     * @param value Value to write.
     * @returns Number of bytes written to the buffer.
     */
    public writeUint8(value: number): number {
        this.byteBuffer.writeByte(value);
        return 1;
    }

    /**
     * Writes a 32-bit unsigned integer to the buffer.
     *
     * @param value Value to write.
     * @returns Number of bytes written to the buffer.
     */
    public writeUint32(value: number): number {
        this.byteBuffer.writeByte(value >> 24);
        this.byteBuffer.writeByte(value >> 16);
        this.byteBuffer.writeByte(value >> 8);
        this.byteBuffer.writeByte(value);
        return 4;
    }

    /**
     * Writes a string to the buffer.
     *
     * @param value Value to write.
     * @returns Number of bytes written to the buffer.
     */
    public writeString(value: string): number {
        return encode(value, this.byteBuffer);
    }
}
