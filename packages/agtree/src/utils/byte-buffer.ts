/* eslint-disable no-bitwise */
/**
 * @file Utility class for handling byte arrays.
 */

/**
 * ByteBuffer class for handling operations on byte arrays.
 * This class allows for the manipulation of Uint8Array chunks,
 * supporting operations like set and get for Uint8 and Uint32 values.
 */
export class ByteBuffer {
    /**
     * Array of Uint8Array chunks.
     */
    public chunks: Uint8Array[] = [];

    /**
     * Current byte offset.
     */
    public byteOffset = 0;

    /**
     * TextEncoder instance for encoding strings to bytes.
     */
    private encoder = new TextEncoder();

    /**
     * TextDecoder instance for decoding bytes to strings.
     */
    private decoder = new TextDecoder();

    /**
     * Gets the total byte length of all chunks.
     *
     * @returns The total byte length.
     */
    public get byteLength(): number {
        return this.chunks.length << 6;
    }

    /**
     * Constructs a new ByteBuffer instance.
     *
     * @param chunks Initial chunks to store in the buffer. Defaults to an empty array.
     */
    constructor(chunks: Uint8Array[] = []) {
        this.chunks = chunks;
    }

    /**
     * Sets a Uint8 value at the specified byte offset.
     *
     * @param byteOffset The offset where the value will be set.
     * @param value The Uint8 value to set.
     */
    public setUint8(byteOffset: number, value: number): void {
        this.chunks[byteOffset >> 6][byteOffset & 63] = value;
    }

    /**
     * Gets a Uint8 value from the specified byte offset.
     *
     * @param byteOffset The offset to retrieve the value from.
     * @returns The Uint8 value at the specified offset.
     */
    public getUint8(byteOffset: number): number {
        return this.chunks[byteOffset >> 6][byteOffset & 63];
    }

    /**
     * Adds a Uint8 value to the buffer at the specified byte offset.
     * Allocates more space if necessary.
     *
     * @param byteOffset The offset where the value will be added.
     * @param value The Uint8 value to add.
     */
    public addUint8(byteOffset: number, value: number): void {
        if (!this.hasCapacity(byteOffset)) {
            this.allocate();
        }

        this.setUint8(byteOffset, value);
        this.byteOffset += 1;
    }

    /**
     * Sets a Uint32 value at the specified byte offset.
     *
     * @param byteOffset The offset where the value will be set.
     * @param value The Uint32 value to set.
     */
    public setUint32(byteOffset: number, value: number) {
        this.setUint8(byteOffset, value >> 24);
        this.setUint8(byteOffset + 1, value >> 16);
        this.setUint8(byteOffset + 2, value >> 8);
        this.setUint8(byteOffset + 3, value);
    }

    /**
     * Gets a Uint32 value from the specified byte offset.
     *
     * @param byteOffset The offset to retrieve the value from.
     * @returns The Uint32 value at the specified offset.
     */
    public getUint32(byteOffset: number) {
        return ((this.getUint8(byteOffset + 3) << 0)
            | (this.getUint8(byteOffset + 2) << 8)
            | (this.getUint8(byteOffset + 1) << 16)
            | (this.getUint8(byteOffset + 0) << 24)) >>> 0;
    }

    /**
     * Adds a Uint32 value to the buffer at the specified byte offset.
     * Allocates more space if necessary.
     *
     * @param byteOffset The offset where the value will be added.
     * @param value The Uint32 value to add.
     */
    public addUint32(byteOffset: number, value: number): void {
        if (!this.hasCapacity(byteOffset + 3)) {
            this.allocate();
        }

        this.setUint32(byteOffset, value);
        this.byteOffset += 4;
    }

    /**
     * Checks if there is sufficient capacity in the buffer for a new entry.
     *
     * @param index The index to check for capacity.
     * @returns True if there is enough capacity, false otherwise.
     */
    private hasCapacity(index: number): boolean {
        return index + 1 >> 6 < this.chunks.length;
    }

    /**
     * Allocates a new chunk in the buffer.
     */
    private allocate(): void {
        this.chunks.push(new Uint8Array(64));
    }

    /**
     * Adds a string to the buffer, encoding it and allocating more space if necessary.
     *
     * @param str The string to add.
     */
    public addString(str: string): void {
        const { length } = str;

        // Add the length of the string as Uint32
        // This is necessary to know how many data should be read when getting the string
        this.addUint32(this.byteOffset, length);

        // Skip if the string is empty
        if (length < 1) {
            return;
        }

        // Index to keep track of the current position in the string
        let i = 0;

        // Get the remaining space in the current (last) chunk
        const remainingSpace = 64 - (this.byteOffset & 63);

        // If there are remaining space, we need to fill it first
        if (remainingSpace > 0) {
            const encoded = this.encoder.encodeInto(
                str.slice(i, remainingSpace),
                this.chunks[this.byteOffset >> 6].subarray(this.byteOffset & 63),
            );

            this.byteOffset += encoded.written;
            i += remainingSpace;
        }

        // Encode the rest of the string in chunks of 64 bytes
        while (i < length) {
            this.allocate();

            const encoded = this.encoder.encodeInto(
                str.slice(i, i + 64),
                this.chunks[this.byteOffset >> 6].subarray(this.byteOffset & 63),
            );

            this.byteOffset += encoded.written;
            i += 64;
        }
    }

    /**
     * Reads a string from the buffer starting at the specified byte offset.
     *
     * @param byteOffset The offset to start reading from.
     * @returns The string read from the buffer.
     */
    public getString(byteOffset: number): string {
        // Read the length of the string as Uint32
        const length = this.getUint32(byteOffset);

        // Skip if the string is empty
        if (length < 1) {
            return '';
        }

        let i = byteOffset + 4;
        let result = '';
        let bytesToRead = length;

        while (bytesToRead > 0) {
            const chunkIndex = i >> 6;
            const chunkOffset = i & 63;
            const currentChunk = this.chunks[chunkIndex];

            // Determine how many bytes we can read from this chunk
            const readLength = Math.min(bytesToRead, 64 - chunkOffset);

            // Decode the current segment of the string
            result += this.decoder.decode(
                currentChunk.subarray(chunkOffset, chunkOffset + readLength),
                { stream: true },
            );

            // Update the counters
            i += readLength;
            bytesToRead -= readLength;
        }

        return result;
    }
}
