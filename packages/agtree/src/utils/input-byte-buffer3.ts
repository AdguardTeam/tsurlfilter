/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
/**
 * @file Input byte buffer for reading binary data.
 */

import { ByteBuffer } from './byte-buffer';
import { isArrayOfUint8Arrays } from './type-guards';

/**
 * Input byte buffer for reading binary data.
 *
 * @note Internally, this class uses a {@link ByteBuffer} instance, just providing a convenient API for reading data.
 */
export class InputByteBuffer3 {
    public static readonly CHUNK_SIZE = 32768; // 32 * 1024

    /**
     * An array of Uint8Array chunks that make up the buffer.
     */
    private chunks: Uint8Array[];

    /**
     * The total number of chunks in the buffer.
     */
    private chunksLength: number;

    private offset: number;

    private readonly DECODER = new TextDecoder();

    private readonly SHARED_BUFFER = new Uint8Array(ByteBuffer.CHUNK_SIZE * 2);

    public static MAX_OPTIMIZED_UINT = 0x1FFFFFFF;

    constructor(chunks: Uint8Array[]) {
        this.chunks = chunks;
        this.chunksLength = chunks.length;
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
    public static async createFromStorage(storage: Storage, key: string): Promise<InputByteBuffer3> {
        const chunks = await storage.get(key);

        if (!isArrayOfUint8Arrays(chunks)) {
            throw new Error('The data from storage is not an array of Uint8Arrays');
        }

        return new InputByteBuffer3(chunks);
    }

    public readString(): string {
        // Read string length
        // TODO: If string is small, we don't need 32 bits - we just use 32 bits for testing the performance first
        // const length = ((this.readByte(position) ?? 0) << 24)
        //             | ((this.readByte(position + 1) ?? 0) << 16)
        //             | ((this.readByte(position + 2) ?? 0) << 8)
        //             | (this.readByte(position + 3) ?? 0);
        const length = this.readOptimizedUint();

        let chunkIndex = this.offset >>> 0x000F;
        const chunkOffset = this.offset & 0x7FFF; // offset is only relevant for the first chunk

        // In 99% of cases string is:
        //  1. stored in the current chunk, or
        //  2. stored in the end of the current chunk and the beginning of the next chunk
        // We should decode these cases without using decoder's stream option

        // case 1.
        if (chunkOffset + length < ByteBuffer.CHUNK_SIZE) {
            this.offset += length;
            return this.DECODER.decode(this.chunks[chunkIndex].subarray(chunkOffset, chunkOffset + length));
            // return '';
        }

        // case 2.
        if (chunkOffset + length < ByteBuffer.CHUNK_SIZE * 2 - chunkOffset) {
            this.SHARED_BUFFER.set(this.chunks[chunkIndex].subarray(chunkOffset), 0);
            this.SHARED_BUFFER.set(
                this.chunks[chunkIndex + 1].subarray(0, length - (ByteBuffer.CHUNK_SIZE - chunkOffset)),
                ByteBuffer.CHUNK_SIZE - chunkOffset,
            );
            this.offset += length;
            return this.DECODER.decode(this.SHARED_BUFFER.subarray(0, length));
        }

        // If we are still here, we should decode the string using the stream option
        const result = [];

        // add first 2 chunks to the result
        result.push(this.DECODER.decode(this.chunks[chunkIndex++].subarray(chunkOffset), { stream: true }));
        result.push(this.DECODER.decode(this.chunks[chunkIndex++], { stream: true }));

        let remaining = length - (ByteBuffer.CHUNK_SIZE * 2 - chunkOffset);

        while (remaining) {
            const chunk = this.chunks[chunkIndex];
            if (!chunk) {
                // throw new Error('Invalid string length');
                break;
            }
            const toRead = Math.min(remaining, ByteBuffer.CHUNK_SIZE);
            result.push(
                this.DECODER.decode(
                    chunk.subarray(0, toRead),
                    { stream: true },
                ),
            );
            remaining -= toRead;
            chunkIndex += 1;
        }

        // Finish decoding, if something is left
        result.push(this.DECODER.decode());

        this.offset += length;
        return result.join('');
    }

    /**
     * Reads a byte from the specified position in the buffer.
     * Returns `undefined` if the position is outside of the buffer's current size.
     *
     * @param position The position from which to read the byte.
     * @returns The read byte value, or `undefined` if the position is out of bounds.
     */
    public readByte(position: number): number | undefined {
        const chunkIndex = position >>> 0x000F;
        const chunkOffset = position & 0x7FFF;

        if (chunkIndex >= this.chunksLength) {
            return undefined;
        }

        return this.chunks[chunkIndex][chunkOffset];
    }

    public readOptimizedUint(): number {
        let result = 0;
        let shift = 0;
        let bytePosition = this.offset;

        while (shift < 28) {
            const byteValue = this.readByte(bytePosition) ?? 0;
            result |= (byteValue & 0x7F) << shift;
            bytePosition++;
            shift += 7;

            if ((byteValue & 0x80) === 0) {
                break;
            }
        }

        this.offset = bytePosition;

        return result;
    }

    /**
     * Reads a 8-bit unsigned integer from the buffer.
     *
     * @returns 8-bit unsigned integer from the buffer.
     */
    public readUint8(): number {
        const result = this.readByte(this.offset++) ?? 0;
        return result;
    }

    /**
     * Reads a 16-bit unsigned integer from the buffer.
     *
     * @returns 16-bit unsigned integer from the buffer.
     */
    public readUint16(): number {
        const result = (((this.readByte(this.offset++) ?? 0) << 8)
            | ((this.readByte(this.offset++) ?? 0))) >>> 0;
        return result;
    }

    /**
     * Reads a 32-bit unsigned integer from the buffer.
     *
     * @returns 32-bit unsigned integer from the buffer.
     */
    public readUint32(): number {
        const result = (((this.readByte(this.offset++) ?? 0) << 24)
            | ((this.readByte(this.offset++) ?? 0) << 16)
            | ((this.readByte(this.offset++) ?? 0) << 8)
            | ((this.readByte(this.offset++) ?? 0))) >>> 0;
        return result;
    }

    /**
     * Reads a 32-bit signed integer from the buffer.
     *
     * @returns 32-bit signed integer from the buffer.
     */
    public readInt32(): number {
        const result = this.readUint32();
        return result > 0x7fffffff ? result - 0x100000000 : result;
    }

    /**
     * Reads a 8-bit unsigned integer from the buffer without advancing the offset.
     *
     * @returns 8-bit unsigned integer from the buffer.
     */
    public peekUint8(): number {
        return this.readByte(this.offset) ?? 0;
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
