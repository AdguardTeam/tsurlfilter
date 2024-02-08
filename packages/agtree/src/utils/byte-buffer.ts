/* eslint-disable no-bitwise */
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
     * The current position in the buffer for writing.
     */
    private offset: number;

    /**
     * Constructs a new ByteBuffer instance.
     *
     * @param chunks An optional initial array of chunks.
     */
    constructor(chunks?: Uint8Array[]) {
        this.chunks = chunks || [new Uint8Array(ByteBuffer.CHUNK_SIZE)];
        this.chunksLength = this.chunks.length;
        this.offset = 0;

        // Calculate the initial offset based on the total size of the provided chunks.
        // This assumes that each chunk is fully utilized except possibly the last one.
        if (chunks && chunks.length > 0) {
            // Sum the lengths of all chunks except the last one, assuming they are full.
            const totalSize = (chunks.length - 1) * ByteBuffer.CHUNK_SIZE;

            // Find the last non-zero byte in the last chunk.
            const lastChunk = chunks[chunks.length - 1];
            for (let i = lastChunk.length - 1; i >= 0; i -= 1) {
                if (lastChunk[i] !== 0) {
                    this.offset = totalSize + i + 1;
                    break;
                }
            }
        }
    }

    /**
     * Returns the current offset in the buffer for writing.
     *
     * @returns The current offset in the buffer.
     */
    public get byteOffset(): number {
        return this.offset;
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
     * Writes a byte at the last position in the buffer and advances the position by one.
     * This method automatically adds a new chunk if the current one is full.
     *
     * @param value The byte value to write (0-255).
     */
    public writeByte(value: number): void {
        const chunkIndex = this.offset >>> 0x000F;
        const chunkOffset = this.offset & 0x7FFF;

        if (chunkIndex >= this.chunksLength) {
            this.ensureCapacity(this.offset);
        }

        this.chunks[chunkIndex][chunkOffset] = value;
        this.offset += 1;
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
}
