/* eslint-disable no-bitwise */
import { ByteBuffer } from './byte-buffer';
import { decodeText } from './text-decoder';

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
     * @param chunks Optional array of chunks to initialize the ByteBuffer with.
     */
    constructor(chunks?: Uint8Array[]) {
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
        const result = (((this.byteBuffer.readByte(this.offset) ?? 0) << 24)
            | ((this.byteBuffer.readByte(this.offset + 1) ?? 0) << 16)
            | ((this.byteBuffer.readByte(this.offset + 2) ?? 0) << 8)
            | ((this.byteBuffer.readByte(this.offset + 3) ?? 0))) >>> 0;
        this.offset += 4;
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

        // if the current byte is 0, we need to skip it
        if (this.byteBuffer.readByte(this.offset) === 0) {
            this.offset += 1;
        }

        return result.decodedText;
    }
}
