/* eslint-disable no-bitwise */
/**
 * A ByteBuffer class for handling binary data in chunks.
 * This class allows for efficient byte storage and manipulation by organizing data into chunks
 * and providing methods to read and write bytes.
 */
export class ByteBuffer {
    /**
     * The size of each chunk in bytes. Default is set to 32 KB.
     */
    public static readonly CHUNK_SIZE = 32 * 1024;

    /**
     * An array of Uint8Array chunks that make up the buffer.
     */
    private chunks: Uint8Array[];

    /**
     * The current position in the buffer for writing.
     */
    private offset = 0;

    /**
     * Constructs a new ByteBuffer instance.
     *
     * @param chunks An optional initial array of chunks.
     */
    constructor(chunks?: Uint8Array[]) {
        this.chunks = chunks || [new Uint8Array(ByteBuffer.CHUNK_SIZE)];
    }

    /**
     * Ensures that the buffer has enough capacity to accommodate a given position.
     * This method adjusts the `chunks` array size to ensure it can hold the specified position.
     *
     * @param position The position to ensure capacity for.
     */
    private ensureCapacity(position: number) {
        const requiredChunkIndex = position >>> 0x000F;
        for (let i = this.chunks.length; i <= requiredChunkIndex; i += 1) {
            this.chunks.push(new Uint8Array(ByteBuffer.CHUNK_SIZE));
        }
    }

    /**
     * Writes a byte at the specified position or at the current offset if no position is specified.
     * This method automatically expands the buffer if necessary.
     *
     * @param value The byte value to write (0-255).
     * @param position The position at which to write the byte. Optional, defaults to the current offset.
     */
    public writeByte(value: number, position?: number): void {
        const pos = position !== undefined ? position : this.offset;
        const chunkIndex = pos >>> 0x000F; // Same as floor(pos / 32 * 1024) for 32KB chunks, using bit shift for speed
        const chunkOffset = pos & 0x7FFF; // Same as pos % this.chunkSize for 32KB chunks

        if (chunkIndex >= this.chunks.length) {
            this.ensureCapacity(pos);
        }

        this.chunks[chunkIndex][chunkOffset] = value;

        // Only increment offset if no position was provided
        if (position === undefined) {
            this.offset = pos + 1;
        }
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

        if (chunkIndex >= this.chunks.length) {
            return undefined;
        }

        return this.chunks[chunkIndex][chunkOffset];
    }
}
