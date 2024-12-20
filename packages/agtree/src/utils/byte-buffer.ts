/* eslint-disable no-bitwise */
/**
 * @file Core ByteBuffer implementation for handling binary data in chunks.
 */

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
    protected chunks: Uint8Array[];

    /**
     * The total number of chunks in the buffer.
     */
    protected chunksLength: number;

    /**
     * Constructs a new ByteBuffer instance.
     *
     * @param chunks Optional array of chunks to initialize the ByteBuffer with.
     * @param cloneChunks Flag indicating if the chunks should be cloned. For performance reasons,
     * its default value is `false`. If the original chunks are guaranteed not to change,
     * leave this flag as `false` to avoid unnecessary copying.
     */
    constructor(chunks?: Uint8Array[], cloneChunks = false) {
        const chunksToUse = chunks ?? [];
        this.chunks = cloneChunks ? chunksToUse.map((chunk) => new Uint8Array(chunk)) : chunksToUse;
        this.chunksLength = chunks?.length ?? 0;
    }

    /**
     * Ensures that the buffer has enough capacity to accommodate a given position.
     * This method adjusts the `chunks` array size to ensure it can hold the specified position.
     *
     * @param position The position to ensure capacity for.
     */
    protected ensureCapacity(position: number) {
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
    protected writeByte(position: number, value: number): void {
        // same as Math.floor(position / chunk size), just optimized for the 32 KB chunk size
        const chunkIndex = position >>> 0x000F;
        // same as position % chunk size, just optimized for the 32 KB chunk size
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
    protected readByte(position: number): number | undefined {
        const chunkIndex = position >>> 0x000F;
        const chunkOffset = position & 0x7FFF;

        if (chunkIndex >= this.chunksLength) {
            return undefined;
        }

        return this.chunks[chunkIndex][chunkOffset];
    }
}
