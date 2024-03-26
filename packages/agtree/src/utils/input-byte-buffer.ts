/* eslint-disable max-len */
/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
/**
 * @file Input byte buffer for reading binary data.
 */
import { ByteBuffer } from './byte-buffer';
import { isArrayOfUint8Arrays } from './type-guards';
import { type Storage } from './storage-interface';
import { isChromium } from './is-chromium';
import { decodeTextPolyfill } from './text-decoder-polyfill';

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
     * Shared buffer for decoding strings.
     */
    private readonly sharedBuffer: Uint8Array;

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
     * Constructs a new InputByteBuffer instance.
     *
     * @param chunks Array of chunks to initialize the ByteBuffer with.
     * @note If you provide chunks, for performance reasons, they are passed by reference and not copied.
     */
    constructor(chunks: Uint8Array[]) {
        super(chunks);

        this.offset = 0;
        this.sharedBuffer = new Uint8Array(ByteBuffer.CHUNK_SIZE * 2);
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

        // In 99% of cases string is:
        //  1. stored in the current chunk, or
        //  2. stored in the end of the current chunk and the beginning of the next chunk
        // We should decode these cases without using decoder's stream option

        // Case 1:
        if (endOffset < ByteBuffer.CHUNK_SIZE) {
            this.offset += length;
            if (this.isChromium) {
                return decodeTextPolyfill(this.chunks[chunkIndex], chunkOffset, endOffset);
            }
            return this.sharedNativeDecoder.decode(this.chunks[chunkIndex].subarray(chunkOffset, endOffset));
        }

        // Case 2:
        if (endOffset < ByteBuffer.CHUNK_SIZE * 2 - chunkOffset) {
            this.sharedBuffer.set(this.chunks[chunkIndex].subarray(chunkOffset), 0);
            this.sharedBuffer.set(
                this.chunks[chunkIndex + 1].subarray(0, length - (ByteBuffer.CHUNK_SIZE - chunkOffset)),
                ByteBuffer.CHUNK_SIZE - chunkOffset,
            );
            this.offset += length;
            if (this.isChromium) {
                return decodeTextPolyfill(this.sharedBuffer, 0, length);
            }
            return this.sharedNativeDecoder.decode(this.sharedBuffer.subarray(0, length));
        }

        // If we are still in the function, we should decode the string using the stream option,
        // because it is large
        const result = [];

        // Add first 2 chunks to the result
        result.push(this.sharedNativeDecoder.decode(this.chunks[chunkIndex++].subarray(chunkOffset), { stream: true }));
        result.push(this.sharedNativeDecoder.decode(this.chunks[chunkIndex++], { stream: true }));

        let remaining = length - (ByteBuffer.CHUNK_SIZE * 2 - chunkOffset);

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
}
