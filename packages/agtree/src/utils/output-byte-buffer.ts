/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
/**
 * @file Output byte buffer for writing binary data.
 */
import { BINARY_SCHEMA_VERSION } from './binary-schema-version.js';
import { ByteBuffer } from './byte-buffer.js';
import { isChromium } from './is-chromium.js';
import { type Storage } from './storage-interface.js';
import { encodeIntoPolyfill } from './text-encoder-polyfill.js';

/**
 * Output byte buffer for writing binary data.
 *
 * @note Internally, this class uses a {@link ByteBuffer} instance, just providing a convenient API for reading data.
 */
export class OutputByteBuffer extends ByteBuffer {
    /**
     * Current offset in the buffer for writing.
     */
    private offset: number;

    /**
     * Size of the shared buffer for encoding strings in bytes.
     * This is a divisor of ByteBuffer.CHUNK_SIZE and experience shows that this value works optimally.
     * This is sufficient for most strings that occur in filter lists (we checked average string length in popular
     * filter lists).
     */
    private static readonly ENCODER_BUFFER_SIZE = 8192;

    /**
     * Length threshold for using a shared buffer for encoding strings.
     * This temp buffer is needed because we write the short strings in it
     * (so there is no need to constantly allocate a new buffer).
     * The reason for dividing ENCODER_BUFFER_SIZE by 4 is to ensure that the encoded string fits in the buffer,
     * if we also take into account the worst possible case (each character is encoded with 4 bytes).
     */
    private static readonly SHORT_STRING_THRESHOLD = 2048; // 8192 / 4

    /**
     * Represents the maximum value that can be written as a 'storage optimized' unsigned integer.
     * 0x1FFFFFFF means 29 bits — 32 bits minus 3 bits — because the last bit in each byte is a flag indicating
     * if there are more bytes (except for the last byte).
     */
    public static MAX_OPTIMIZED_UINT = 0x1FFFFFFF;

    /**
     * Shared buffer for encoding strings.
     */
    private readonly sharedBuffer: Uint8Array;

    /**
     * Shared native encoder for encoding strings.
     */
    private readonly sharedNativeEncoder: TextEncoder;

    /**
     * Flag indicating if the current environment is Chromium.
     * This is used for performance optimizations, because Chromium's TextEncoder/TextDecoder has a relatively
     * large marshalling overhead for small strings.
     */
    private readonly isChromium: boolean;

    /**
     * Constructs a new OutputByteBuffer instance.
     */
    // TODO: add chunks as a parameter, if ever needed
    constructor() {
        super();

        this.sharedBuffer = new Uint8Array(OutputByteBuffer.ENCODER_BUFFER_SIZE);
        this.sharedNativeEncoder = new TextEncoder();
        this.isChromium = isChromium();

        // write the schema version at the beginning of the buffer
        this.writeUint32ToIndex(BINARY_SCHEMA_VERSION, 0);

        this.offset = 4; // schema version is already written
    }

    /**
     * Writes a 8-bit unsigned integer to the buffer.
     *
     * @param value Value to write.
     * @returns Number of bytes written to the buffer.
     */
    public writeUint8(value: number): number {
        this.writeByte(this.offset++, value);
        return 1;
    }

    /**
     * Writes a 16-bit unsigned integer to the buffer.
     *
     * @param value Value to write.
     * @returns Number of bytes written to the buffer.
     */
    public writeUint16(value: number): number {
        this.writeByte(this.offset++, value >> 8);
        this.writeByte(this.offset++, value);
        return 2;
    }

    /**
     * Writes a 32-bit unsigned integer to the buffer at a specific index.
     *
     * @param value Value to write.
     * @param index Index to write the value to.
     * @returns Number of bytes written to the buffer.
     */
    private writeUint32ToIndex(value: number, index: number): number {
        this.writeByte(index, value >> 24);
        this.writeByte(index + 1, value >> 16);
        this.writeByte(index + 2, value >> 8);
        this.writeByte(index + 3, value);
        return 4;
    }

    /**
     * Writes a 32-bit unsigned integer to the buffer.
     *
     * @param value Value to write.
     * @returns Number of bytes written to the buffer.
     */
    public writeUint32(value: number): number {
        this.writeUint32ToIndex(value, this.offset);
        this.offset += 4;
        return 4;
    }

    /**
     * Writes a 32-bit signed integer to the buffer.
     *
     * @param value Value to write.
     * @returns Number of bytes written to the buffer.
     */
    public writeInt32(value: number): number {
        return this.writeUint32(value ? value >>> 0 : 0);
    }

    /**
     * Writes a Uint8Array to the byte buffer.
     *
     * @param buffer Buffer to write.
     */
    private writeBuffer(buffer: Uint8Array): void {
        const { length } = buffer;
        this.ensureCapacity(this.offset + length);

        let chunkIndex = this.offset >>> 0x000F;
        let chunkOffset = this.offset & 0x7FFF;
        let remainingBytes = length;

        while (remainingBytes) {
            const leftInChunk = ByteBuffer.CHUNK_SIZE - chunkOffset;
            const bytesToWrite = Math.min(remainingBytes, leftInChunk);

            this.chunks[chunkIndex].set(
                buffer.subarray(length - remainingBytes, length - remainingBytes + bytesToWrite),
                chunkOffset,
            );
            remainingBytes -= bytesToWrite;
            chunkIndex += 1;
            chunkOffset = 0;
        }
    }

    /**
     * Writes a string to the buffer.
     *
     * @param value Value to write.
     * @returns Number of bytes written to the buffer.
     */
    public writeString(value: string): number {
        const start = this.offset;

        if (value.length <= OutputByteBuffer.SHORT_STRING_THRESHOLD) {
            let bytesWritten: number;

            if (this.isChromium) {
                bytesWritten = encodeIntoPolyfill(value, this.sharedBuffer).written ?? 0;
            } else {
                bytesWritten = this.sharedNativeEncoder.encodeInto(value, this.sharedBuffer).written ?? 0;
            }

            this.writeOptimizedUint(bytesWritten);
            this.writeBuffer(this.sharedBuffer.subarray(0, bytesWritten));

            this.offset += bytesWritten;

            return this.offset - start;
        }

        // TODO: Optimize for long strings, if needed. Not a common case for our use case
        const buffer = this.sharedNativeEncoder.encode(value);
        const bytesWritten = buffer.length;

        this.writeOptimizedUint(bytesWritten);
        this.writeBuffer(buffer);
        this.offset += bytesWritten;

        return this.offset - start;
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

    /**
     * Writes an 'optimized' unsigned integer to the buffer.
     * 'Optimized' means smaller storage usage for smaller numbers.
     * Except for the last byte, each byte's most significant bit is a flag indicating if there are more bytes.
     *
     * @param value Value to write.
     * @returns Number of bytes written to the buffer.
     * @throws If the value exceeds the 29-bit limit.
     */
    public writeOptimizedUint(value: number): number {
        if (value < 0 || value > OutputByteBuffer.MAX_OPTIMIZED_UINT) {
            throw new Error('Value exceeds 29-bit limit');
        }

        let remainingValue = value;
        const startOffset = this.offset;

        while (remainingValue >= 0x80) {
            const byteValue = remainingValue & 0x7F;
            remainingValue >>>= 7;
            this.writeByte(this.offset++, byteValue | 0x80);
        }

        this.writeByte(this.offset++, remainingValue);

        return this.offset - startOffset;
    }

    /**
     * Gets the current offset in the buffer for writing.
     *
     * @returns Current offset in the buffer for writing.
     */
    public get currentOffset(): number {
        return this.offset;
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
