/* eslint-disable no-bitwise */
/**
 * @file Core ByteBuffer implementation for handling binary data in chunks.
 */

import { type Storage } from './storage-interface';

/**
 * Core ByteBuffer implementation for handling binary data in chunks.
 * This class allows for efficient byte storage and manipulation by organizing data into chunks
 * and providing methods to read and write bytes.
 */
export class ByteBuffer {
    /**
     * The size of each chunk in bytes (32 KB).
     */
    // ! IMPORTANT: If you ever change this value, make sure to update optimized bitwise operations in the code.
    public static readonly CHUNK_SIZE = 32768; // 32 * 1024

    /**
     * An array of Uint8Array chunks that make up the buffer.
     */
    private chunks: Uint8Array[];

    /**
     * The total number of chunks in the buffer.
     */
    private chunksLength: number;

    /**
     * Constructs a new ByteBuffer instance.
     *
     * @param chunks Optional array of chunks to initialize the ByteBuffer with.
     * @note If you provide chunks, for performance reasons, they are passed by reference and not copied.
     */
    constructor(chunks?: Uint8Array[]) {
        this.chunks = chunks ?? [];
        this.chunksLength = chunks?.length ?? 0;
    }

    /**
     * Ensures that the buffer has enough capacity to accommodate a given position.
     * This method adjusts the `chunks` array size to ensure it can hold the specified position.
     *
     * @param position The position to ensure capacity for.
     */
    private ensureCapacity(position: number) {
        // same as Math.floor(position / chunk size), just optimized for the 32 KB chunk size
        const requiredChunkIndex = position >>> 0x000F;
        for (let i = this.chunksLength; i <= requiredChunkIndex; i += 1) {
            this.chunks.push(new Uint8Array(ByteBuffer.CHUNK_SIZE));
            this.chunksLength += 1;
        }
    }

    /**
     * Writes a byte to the buffer at the specified position.
     * If the position is outside of the buffer's current size, the buffer is resized to accommodate it.
     *
     * @param position The position at which to write the byte.
     * @param value The byte value to write (0-255).
     */
    public writeByte(position: number, value: number): void {
        // same as Math.floor(position / chunk size), just optimized for the 32 KB chunk size
        const chunkIndex = position >>> 0x000F;
        // same as position % chunk size, just optimized for the 32 KB chunk size
        const chunkOffset = position & 0x7FFF;

        if (chunkIndex >= this.chunksLength) {
            this.ensureCapacity(position);
        }

        this.chunks[chunkIndex][chunkOffset] = value;
    }

    private static readonly DECODER = new TextDecoder();

    /**
     * Reads a null-terminated string from the byte buffer.
     *
     * @param position Position to start from.
     * @returns String that was read from the byte buffer.
     */
    public readString(position: number): string {
        // TODO: !!! DIRTY JUST FOR BENCH
        // WHERE POSITION IS 0 AND EVERYTHING FITS IN ONE CHUNK.

        const chunkIndex = position >>> 0x000F;
        const chunkOffset = position & 0x7FFF;
        const leftInChunk = this.chunks[chunkIndex].subarray(chunkOffset);
        let endOfString = 0;

        for (let i = 0; i < leftInChunk.length; i += 1) {
            if (leftInChunk[i] === 0) {
                endOfString = i;

                break;
            }
        }

        return ByteBuffer.DECODER.decode(leftInChunk.subarray(0, endOfString));
    }

    readString2(position: number): string {
        let chunkIndex = position >>> 0x000F;
        // TODO: check out of bounds
        let chunkOffset = position & 0x7FFF;
        let chunk = this.chunks[chunkIndex];
        let result = '';
        let nullIdx;

        while (chunkIndex < this.chunksLength) {
            nullIdx = chunk.indexOf(0, chunkOffset);
            if (nullIdx !== -1) {
                result += ByteBuffer.DECODER.decode(chunk.subarray(0, nullIdx));
                return result;
            }
            result += ByteBuffer.DECODER.decode(chunk, { stream: true });
            chunkIndex += 1;
            chunkOffset = 0;
            chunk = this.chunks[chunkIndex];
        }
        return result;
    }

    /**
     * Reads a string encoded as length+bytes.
     *
     * @param position Position to start from.
     * @returns String that was read from the byte buffer.
     */
    public readStringNew(position: number): string {
        const chunkIndex = position >>> 0x000F;
        const chunkOffset = position & 0x7FFF;
        const leftInChunk = this.chunks[chunkIndex].subarray(chunkOffset);

        // Decode string length first.
        const highByte = leftInChunk[0];
        const lowByte = leftInChunk[1];
        // eslint-disable-next-line no-bitwise
        const bytesToRead = (highByte << 8) | lowByte;

        // TODO: Handle the case when string does not fit in one chunk:
        // Use an intermediate shared buffer in this case.

        return ByteBuffer.DECODER.decode(leftInChunk.subarray(2, bytesToRead + 2));
    }

    /**
     * Reads a sequence of bytes from the buffer into the specified destination
     * array starting at the specified position. Returns the number of bytes
     * that it was able to read.
     *
     * @param position The position at which to start reading.
     * @param dst Destination array.
     * @returns The number of bytes read.
     */
    public read(position: number, dst: Uint8Array): number {
        const chunkIndex = position >>> 0x000F;
        const chunkOffset = position & 0x7FFF;

        if (chunkIndex >= this.chunksLength) {
            return 0;
        }

        const leftInChunkSlice = this.chunks[chunkIndex].subarray(chunkOffset);
        const bytesToRead = Math.min(dst.length, leftInChunkSlice.length);
        dst.set(leftInChunkSlice.subarray(0, bytesToRead));

        return bytesToRead;
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

    /**
     * Writes chunks to the storage.
     *
     * @param storage Storage to write the chunks to.
     * @param key Key to write the chunks to.
     * @note For performance reasons, chunks are passed by reference and not copied.
     * @throws If the storage write operation throws.
     */
    public async writeChunksToStorage(storage: Storage, key: string): Promise<void> {
        await storage.set(key, this.chunks);
    }
}
