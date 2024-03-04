/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
/**
 * @file Output byte buffer for writing binary data.
 */

import { ByteBuffer } from './byte-buffer';
import { OutputByteBuffer } from './output-byte-buffer';

/**
 * Output byte buffer for writing binary data.
 *
 * @note Internally, this class uses a {@link ByteBuffer} instance, just providing a convenient API for reading data.
 */
export class OutputByteBuffer2 extends OutputByteBuffer {
    /**
     * Writes a string to the buffer.
     *
     * @param value Value to write.
     * @returns Number of bytes written to the buffer.
     */
    public writeString(value: string): number {
        // wrapped native encoder
        const bytesWritten = this.byteBuffer.writeString3(this.offset, value);
        this.offset += bytesWritten;
        return bytesWritten;
    }
}
