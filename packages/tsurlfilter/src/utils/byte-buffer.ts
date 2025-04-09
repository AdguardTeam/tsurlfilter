/* eslint-disable jsdoc/multiline-blocks */
/**
 * The ByteBuffer class is used to read and write bytes.
 * Data is stored in buckets of 64 bytes.
 * When writing new data, ByteBuffer checks the available capacity
 * and if necessary creates the new bucket.
 * It can be easily read and written to persistent storage via the Storage API.
 */
export class ByteBuffer {
    /**
     * The initial number of memory pages to allocate.
     * Each page is 64KB in size.
     */
    private static INITIAL_MEMORY_PAGES_SIZE = 1;

    /**
     * The number of memory pages to allocate when the buffer is full.
     */
    private static MEMORY_PAGES_DELTA = 1;

    /**
     * Buffer memory represented as WebAssembly.Memory.
     * We use this API to support dynamic memory allocation with compatibility for older browsers.
     *
     * @see https://developer.mozilla.org/en-US/docs/WebAssembly/JavaScript_interface/Memory
     * On buffer initialization, the memory is set to {@link ByteBuffer.INITIAL_MEMORY_PAGES_SIZE} and
     * grows with the number of pages specified in {@link ByteBuffer.MEMORY_PAGES_DELTA}.
     * @see {@link allocate}
     */
    declare public memory: WebAssembly.Memory;

    /**
     * Buffer data represented as DataView.
     */
    declare public data: DataView;

    /**
     * Global byte offset.
     */
    public byteOffset: number = 0;

    /**
     * @param data The initial data.
     *
     * NOTE: If the existed data it provided, the new memory will not be allocated.
     *
     * @inheritdoc
     */
    constructor(data?: DataView) {
        if (data) {
            /**
             * If the data view is provided, we just assign it to the byte buffer
             * without creating a new memory instance to avoid extra copying.
             */
            this.data = data;
        } else {
            /**
             * Otherwise, we create a new memory instance with the initial page size and connect it to the data view.
             */
            this.memory = new WebAssembly.Memory({
                initial: ByteBuffer.INITIAL_MEMORY_PAGES_SIZE,
            });
            this.data = new DataView(this.memory.buffer);
        }
    }

    /**
     * Sets uint8 value to buffer. This method is used for overwriting value.
     * WARNING: This method does not allocate memory.
     *
     * @param byteOffset The byte offset of the value.
     * @param value The uint8 value to set.
     */
    public setUint8(byteOffset: number, value: number): void {
        this.data.setUint8(byteOffset, value);
    }

    /**
     * Gets uint8 value from buffer.
     *
     * @param byteOffset The byte offset of the value.
     *
     * @returns The uint8 value.
     */
    public getUint8(byteOffset: number): number {
        return this.data.getUint8(byteOffset);
    }

    /**
     * Adds uint8 to the buffer.
     * If the buffer does not have enough capacity, new chunks will be allocated.
     *
     * @param byteOffset The byte offset of the value.
     * @param value The uint8 value to set.
     */
    public addUint8(byteOffset: number, value: number): void {
        if (!this.hasCapacity(byteOffset)) {
            this.allocate();
        }

        this.data.setUint8(byteOffset, value);
        this.byteOffset += 1; // Uint8Array.BYTES_PER_ELEMENT
    }

    /**
     * Sets uint32 value to buffer. This method is used for overwriting value.
     * NOTE: This method does not allocate memory.
     *
     * @param byteOffset The byte offset of the value.
     * @param value The uint32 value to set.
     */
    public setUint32(byteOffset: number, value: number): void {
        this.data.setUint32(byteOffset, value);
    }

    /**
     * Gets uint32 value from buffer.
     *
     * @param byteOffset The byte offset of the value.
     *
     * @returns Uint32 value.
     */
    public getUint32(byteOffset: number) {
        return this.data.getUint32(byteOffset);
    }

    /**
     * Adds uint32 to the buffer.
     * If the buffer does not have enough capacity, new chunks will be allocated.
     *
     * @param byteOffset The byte offset of the value.
     * @param value Uint32 value to set.
     */
    public addUint32(byteOffset: number, value: number): void {
        while (!this.hasCapacity(byteOffset + 3 /** Uint32Array.BYTES_PER_ELEMENT - 1. */)) {
            this.allocate();
        }

        this.data.setUint32(byteOffset, value);
        this.byteOffset += 4; // Uint32Array.BYTES_PER_ELEMENT
    }

    /**
     * Checks if the buffer has enough capacity for the specified index.
     *
     * @param index The buffer byte index.
     *
     * @returns True if the buffer has enough capacity, otherwise false.
     */
    private hasCapacity(index: number): boolean {
        return index < this.data.byteLength;
    }

    /**
     * Allocates new chunk of 64 bytes.
     */
    private allocate(): void {
        this.memory.grow(ByteBuffer.MEMORY_PAGES_DELTA);
        /**
         * Every call to grow will detach any references to the old buffer.
         * So we need to reassign the buffer to the data view.
         */
        this.data = new DataView(this.memory.buffer);
    }

    /**
     * Adds the contents of another ByteBuffer into this one.
     * It ensures enough capacity and copies each byte from the source buffer.
     *
     * @param buffer The ByteBuffer to copy from.
     */
    public addByteBuffer(buffer: ByteBuffer): void {
        const sourceLength = buffer.byteOffset;

        // Ensure capacity in current buffer
        const requiredCapacity = this.byteOffset + sourceLength;
        while (!this.hasCapacity(requiredCapacity - 1)) {
            this.allocate();
        }

        // Copy each byte from the source buffer
        for (let i = 0; i < sourceLength; i += 1) {
            const byte = buffer.getUint8(i);
            this.setUint8(this.byteOffset + i, byte);
        }

        this.byteOffset += sourceLength;
    }
}
