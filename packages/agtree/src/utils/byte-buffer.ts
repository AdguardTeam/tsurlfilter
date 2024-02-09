/* eslint-disable no-bitwise */

import { type Storage } from './storage-interface';

/**
 * A ByteBuffer class for handling binary data in chunks.
 * This class allows for efficient byte storage and manipulation by organizing data into chunks
 * and providing methods to read and write bytes.
 *
 * @note This buffer is quite simple and designed for adding data linearly,
 * because we don't need to modify the already written data.
 */
export class ByteBuffer {
    /**
     * The size of each chunk in bytes (32 KB).
     */
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
     * @note If you provide chunks, they will be used by reference, not copied.
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
        const chunkIndex = position >>> 0x000F;
        const chunkOffset = position & 0x7FFF;

        if (chunkIndex >= this.chunksLength) {
            this.ensureCapacity(position);
        }

        this.chunks[chunkIndex][chunkOffset] = value;
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
     */
    public async writeChunksToStorage(storage: Storage, key: string): Promise<void> {
        await storage.write(key, this.chunks);
    }
}
