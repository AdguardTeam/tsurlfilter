/* eslint-disable max-len */
/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
/**
 * @file Input byte buffer for reading binary data.
 */
import { ByteBuffer } from './byte-buffer.js';
import { isArrayOfUint8Arrays } from './type-guards.js';
import { type Storage } from './storage-interface.js';
import { isChromium } from './is-chromium.js';
import { decodeTextPolyfill } from './text-decoder-polyfill.js';
import { BINARY_SCHEMA_VERSION } from './binary-schema-version.js';
import { BinarySchemaMismatchError } from '../errors/binary-schema-mismatch-error.js';

/**
 * Input byte buffer for reading binary data.
 *
 * @note Internally, this class uses a {@link ByteBuffer} instance, just providing a convenient API for reading data.
 */
export class InputByteBuffer extends ByteBuffer {
    /**
     * Current offset in the buffer for reading.
     */
    private offset: number;

    /**
     * Shared native decoder for decoding strings.
     */
    private readonly sharedNativeDecoder: TextDecoder;

    /**
     * Flag indicating if the current environment is Chromium.
     * This is used for performance optimizations, because Chromium's TextEncoder/TextDecoder has a relatively
     * large marshalling overhead for small strings.
     */
    private readonly isChromium: boolean;

    /**
     * Constructs a new `InputByteBuffer` instance.
     *
     * @param chunks Array of chunks to initialize the ByteBuffer with.
     * @param cloneChunks Flag indicating if the chunks should be cloned. For performance reasons,
     * its default value is `false`. If the original chunks are guaranteed not to change,
     * leave this flag as `false` to avoid unnecessary copying.
     * @param initialOffset Initial offset in the buffer for reading.
     *
     * @throws If the specified chunks array is empty.
     * @throws If the binary schema version in the buffer is not equal to the expected version.
     * @throws If the initial offset is out of bounds.
     */
    constructor(chunks: Uint8Array[], cloneChunks = false, initialOffset = 0) {
        super(chunks, cloneChunks);

        // TODO: Consider accepting an empty array of chunks
        // Check binary schema version
        if (chunks.length === 0) {
            throw new Error('No data in the buffer');
        }

        const actualVersion = this.readSchemaVersion();
        if (actualVersion !== BINARY_SCHEMA_VERSION) {
            throw new BinarySchemaMismatchError(BINARY_SCHEMA_VERSION, actualVersion);
        }

        // Throw an error if the initial offset is out of bounds
        if (initialOffset < 0 || initialOffset > this.chunks.length * ByteBuffer.CHUNK_SIZE) {
            throw new Error(`Invalid offset: ${initialOffset}`);
        }

        // Schema version is always stored at the beginning of the buffer - skip it, because it is already processed
        this.offset = Math.max(4, initialOffset);
        this.sharedNativeDecoder = new TextDecoder();
        this.isChromium = isChromium();
    }

    /**
     * Creates a new InputByteBuffer instance from a Storage instance by reading chunks from the storage.
     *
     * @param storage Storage instance.
     * @param key Key to read from the storage.
     * @returns New InputByteBuffer instance.
     * @note For performance reasons, chunks are passed by reference and not copied.
     */
    public static async createFromStorage(storage: Storage, key: string): Promise<InputByteBuffer> {
        const chunks = await storage.get(key);

        if (!isArrayOfUint8Arrays(chunks)) {
            throw new Error('The data from storage is not an array of Uint8Arrays');
        }

        return new InputByteBuffer(chunks);
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
     * Reads a 32-bit unsigned integer from the buffer at the specified index.
     *
     * @param index Index to read the 32-bit unsigned integer from.
     *
     * @returns 32-bit unsigned integer from the buffer.
     */
    private readUint32FromIndex(index: number): number {
        const result = (((this.readByte(index) ?? 0) << 24)
            | ((this.readByte(index + 1) ?? 0) << 16)
            | ((this.readByte(index + 2) ?? 0) << 8)
            | ((this.readByte(index + 3) ?? 0))) >>> 0;
        return result;
    }

    /**
     * Reads a 32-bit unsigned integer from the buffer.
     *
     * @returns 32-bit unsigned integer from the buffer.
     */
    public readUint32(): number {
        const result = this.readUint32FromIndex(this.offset);
        this.offset += 4;
        return result;
    }

    /**
     * Reads schema version from the buffer.
     *
     * @returns 32-bit unsigned integer from the buffer.
     * @note Schema version is always stored at the beginning of the buffer.
     */
    public readSchemaVersion(): number {
        return this.readUint32FromIndex(0);
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
     * Reads an optimized unsigned integer from the buffer.
     * 'Optimized' means that the integer is stored in a variable number of bytes, depending on its value,
     * so that smaller numbers occupy less space.
     *
     * @returns Decoded unsigned integer from the buffer.
     */
    public readOptimizedUint(): number {
        let result = 0;
        let shift = 0;

        while (shift <= 28) {
            const byteValue = this.readByte(this.offset++) ?? 0;
            result |= (byteValue & 0x7F) << shift;
            shift += 7;

            if ((byteValue & 0x80) === 0) {
                break;
            }
        }

        return result;
    }

    /**
     * Reads a string from the buffer.
     *
     * @returns Decoded string from the buffer.
     */
    public readString(): string {
        const length = this.readOptimizedUint();

        let chunkIndex = this.offset >>> 0x000F;
        const chunkOffset = this.offset & 0x7FFF; // offset is only relevant for the first chunk
        const endOffset = chunkOffset + length;

        // In most cases, the string is stored in the current chunk
        if (endOffset < ByteBuffer.CHUNK_SIZE) {
            this.offset += length;
            if (this.isChromium) {
                return decodeTextPolyfill(this.chunks[chunkIndex], chunkOffset, endOffset);
            }
            return this.sharedNativeDecoder.decode(this.chunks[chunkIndex].subarray(chunkOffset, endOffset));
        }

        const result = [];
        result.push(this.sharedNativeDecoder.decode(this.chunks[chunkIndex++].subarray(chunkOffset), { stream: true }));
        let remaining = length - (ByteBuffer.CHUNK_SIZE - chunkOffset);

        while (remaining) {
            const chunk = this.chunks[chunkIndex];
            if (!chunk) {
                break;
            }
            const toRead = Math.min(remaining, ByteBuffer.CHUNK_SIZE);
            result.push(this.sharedNativeDecoder.decode(chunk.subarray(0, toRead), { stream: true }));
            remaining -= toRead;
            chunkIndex += 1;
        }

        // Finish decoding, if something is left
        result.push(this.sharedNativeDecoder.decode());

        this.offset += length;

        return result.join('');
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

    /**
     * Creates a new `InputByteBuffer` instance with the given initial offset.
     *
     * @param initialOffset Initial offset for the new buffer.
     * @param cloneChunks Flag indicating if the chunks should be cloned. For performance reasons,
     * its default value is `false`. If the original chunks are guaranteed not to change,
     * leave this flag as `false` to avoid unnecessary copying.
     *
     * @returns New `InputByteBuffer` instance with the given initial offset.
     *
     * @note This method is useful if you want to read some data from a specific index.
     */
    public createCopyWithOffset(initialOffset: number, cloneChunks = false): InputByteBuffer {
        return new InputByteBuffer(this.chunks, cloneChunks, initialOffset);
    }

    /**
     * Gets the current offset in the buffer for reading.
     *
     * @returns Current offset in the buffer for reading.
     */
    public get currentOffset(): number {
        return this.offset;
    }

    /**
     * Gets the capacity of the buffer.
     *
     * @returns Capacity of the buffer.
     */
    public get capacity(): number {
        return this.chunks.length * ByteBuffer.CHUNK_SIZE;
    }

    /**
     * Gets the chunks of the buffer.
     *
     * @returns Chunks of the buffer.
     */
    public getChunks(): Uint8Array[] {
        return this.chunks;
    }
}
