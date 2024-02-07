/* eslint-disable no-bitwise */
import { ByteBufferCore } from './byte-buffer-core';

/**
 * A ByteBuffer class for handling binary data in chunks.
 * This class allows for efficient byte storage and manipulation by organizing data into chunks
 * and providing methods to read and write bytes.
 */
export class ByteBuffer extends ByteBufferCore {
    /**
     * Writes a 32-bit unsigned integer to the buffer.
     *
     * @param value The value to write.
     * @returns The number of bytes written to the buffer.
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
     * @param position The position to read from.
     * @returns The 32-bit unsigned integer at the specified position.
     * @note The returned value is an unsigned integer.
     */
    public readUint32(position: number): number {
        return (((this.readByte(position) ?? 0) << 24)
            | ((this.readByte(position + 1) ?? 0) << 16)
            | ((this.readByte(position + 2) ?? 0) << 8)
            | ((this.readByte(position + 3) ?? 0))) >>> 0;
    }

    // FIXME: implement `writeString` and `readString`
}
