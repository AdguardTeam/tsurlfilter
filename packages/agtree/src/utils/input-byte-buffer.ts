/* eslint-disable no-bitwise */
import { type ByteBuffer } from './byte-buffer';
import { decode } from './text-decoder';

/**
 * Input byte buffer for reading binary data from right to left.
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
     * @param byteBuffer ByteBuffer for reading binary data.
     */
    constructor(byteBuffer: ByteBuffer) {
        this.byteBuffer = byteBuffer;
        this.offset = byteBuffer.byteOffset - 1; // last is always undefined
    }

    /**
     * Returns the current offset in the buffer for reading.
     *
     * @returns The current offset in the buffer.
     */
    public get byteOffset(): number {
        return this.offset;
    }

    /**
     * Reads a 8-bit unsigned integer from the buffer.
     *
     * @returns 8-bit unsigned integer from the buffer.
     */
    public readUint8(): number {
        this.offset -= 1;
        return this.byteBuffer.readByte(this.offset + 1) ?? 0;
    }

    /**
     * Reads a 32-bit unsigned integer from the buffer.
     *
     * @returns 32-bit unsigned integer from the buffer.
     */
    public readUint32(): number {
        this.offset -= 4;
        return (
            ((this.byteBuffer.readByte(this.offset + 1) ?? 0) << 24)
            | ((this.byteBuffer.readByte(this.offset + 2) ?? 0) << 16)
            | ((this.byteBuffer.readByte(this.offset + 3) ?? 0) << 8)
            | (this.byteBuffer.readByte(this.offset + 4) ?? 0)
        ) >>> 0;
    }

    /**
     * Reads a string from the buffer.
     *
     * @param length Length of the byte sequence to decode.
     * @returns Decoded string from the buffer.
     */
    public readString(length: number): string {
        this.offset -= length;
        return decode(this.byteBuffer, this.offset + 1, length);
    }
}
