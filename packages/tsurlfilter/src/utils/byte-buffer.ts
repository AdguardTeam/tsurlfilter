/**
 * The ByteBuffer class is used to read and write bytes.
 * Data is stored in buckets of 64 bytes.
 * When writing new data, ByteBuffer checks the available capacity
 * and if necessary creates the new bucket.
 * It can be easily read and written to persistent storage via the Storage API.
 */
export class ByteBuffer {
    /**
     * Buffer data.
     */
    public chunks: Uint8Array[] = [];

    /**
     * Global byte offset.
     */
    public byteOffset: number = 0;

    /**
     * @inheritdoc
     * @param chunks The initial data.
     */
    constructor(chunks: Uint8Array[] = []) {
        this.chunks = chunks;
    }

    /**
     * Sets uint8 value to buffer. This method is used for overwriting value.
     * NOTE: This method does not allocate memory.
     * @param byteOffset The byte offset of the value.
     * @param value The uint8 value to set.
     */
    public setUint8(byteOffset: number, value: number): void {
        this.chunks[byteOffset >> 6][byteOffset & 63] = value;
    }

    /**
     * Gets uint8 value from buffer.
     * @param byteOffset The byte offset of the value.
     * @returns The uint8 value.
     */
    public getUint8(byteOffset: number): number {
        return this.chunks[byteOffset >> 6][byteOffset & 63];
    }

    /**
     * Adds uint8 to the buffer.
     * If the buffer does not have enough capacity, new chunks will be allocated.
     * @param byteOffset The byte offset of the value.
     * @param value The uint8 value to set.
     */
    public addUint8(byteOffset: number, value: number): void {
        if (!this.hasCapacity(byteOffset)) {
            this.allocate();
        }

        this.setUint8(byteOffset, value);
        this.byteOffset += 1; // Uint8Array.BYTES_PER_ELEMENT
    }

    /**
     * Sets uint32 value to buffer. This method is used for overwriting value.
     * NOTE: This method does not allocate memory.
     * @param byteOffset The byte offset of the value.
     * @param value The uint32 value to set.
     */
    public setUint32(byteOffset: number, value: number): void {
        this.setUint8(byteOffset, value >> 24);
        this.setUint8(byteOffset + 1, value >> 16);
        this.setUint8(byteOffset + 2, value >> 8);
        this.setUint8(byteOffset + 3, value);
    }

    /**
     * Gets uint32 value from buffer.
     * @param byteOffset The byte offset of the value.
     * @returns uint32 value.
     */
    public getUint32(byteOffset: number) {
        return ((this.getUint8(byteOffset + 3) << 0)
            | (this.getUint8(byteOffset + 2) << 8)
            | (this.getUint8(byteOffset + 1) << 16)
            | (this.getUint8(byteOffset + 0) << 24)) >>> 0;
    }

    /**
     * Adds uint32 to the buffer.
     * If the buffer does not have enough capacity, new chunks will be allocated.
     * @param byteOffset The byte offset of the value.
     * @param value uint32 value to set.
     */
    public addUint32(byteOffset: number, value: number): void {
        if (!this.hasCapacity(byteOffset + 3 /** Uint32Array.BYTES_PER_ELEMENT - 1 */)) {
            this.allocate();
        }

        this.setUint32(byteOffset, value);
        this.byteOffset += 4; // Uint32Array.BYTES_PER_ELEMENT
    }

    /**
     * Adds storage index to the buffer.
     * Storage index is a positive float64 number where integral part is rule id
     * and fractional part is list id.
     * We split this value in two uint32 values and read ids directly
     * to avoid double conversion while retrieving rule for specified request from storage.
     * @param byteOffset The byte offset of the value.
     * @param value float64 representation of storage index.
     */
    public addStorageIndex(byteOffset: number, value: number): void {
        if (!this.hasCapacity(byteOffset + 7 /** Uint32Array.BYTES_PER_ELEMENT * 2 - 1 */)) {
            this.allocate();
        }

        const integral = Math.trunc(value);
        const fractional = Math.round((value % 1) * 1_000_000 /* Max list id value */);

        this.setUint32(byteOffset, integral);
        this.setUint32(byteOffset + 4 /** Uint32Array.BYTES_PER_ELEMENT */, fractional);

        this.byteOffset += 8; // Uint32Array.BYTES_PER_ELEMENT * 2
    }

    /**
     * Checks if the buffer has enough capacity for the specified index.
     * @param index The buffer byte index.
     * @returns True if the buffer has enough capacity, otherwise false.
     */
    private hasCapacity(index: number): boolean {
        return index + 1 >> 6 < this.chunks.length;
    }

    /**
     * Allocates new chunk of 64 bytes.
     */
    private allocate(): void {
        this.chunks.push(new Uint8Array(64));
    }
}
