import { type ILineReader } from './line-reader';

/**
 * BufferLineReader is a class responsible for reading content line by line
 * from a bytes buffer with a UTF-8 encoded string.
 */
export class BufferLineReader implements ILineReader {
    /**
     * EOL is a new line character that is used to detect line endings. We only
     * rely on \n and not \r so the lines need to be trimmed after processing.
     */
    public static readonly EOL = '\n'.charCodeAt(0);

    /**
     * Byte buffer with a UTF-8 encoded string.
     */
    private readonly buffer: Uint8Array;

    /**
     * Current position of the reader.
     */
    private currentIndex = 0;

    /**
     * Text decoder that is used to read strings from the internal buffer of
     * UTF-8 encoded characters.
     */
    private static readonly decoder = new TextDecoder('utf-8');

    /**
     * Constructor of a BufferLineReader.
     *
     * @param buffer - Uint8Array that contains a UTF-8 encoded string.
     */
    constructor(buffer: Uint8Array) {
        this.buffer = buffer;
    }

    /**
     * Reads the next line in the buffer
     *
     * @return text or null on end
     */
    public readLine(): string | null {
        if (this.currentIndex === -1) {
            return null;
        }

        const startIndex = this.currentIndex;
        this.currentIndex = this.buffer.indexOf(BufferLineReader.EOL, startIndex);

        if (this.currentIndex === -1) {
            return BufferLineReader.decoder.decode(this.buffer.subarray(startIndex));
        }

        const lineBytes = this.buffer.subarray(startIndex, this.currentIndex);
        const line = BufferLineReader.decoder.decode(lineBytes);

        // Increment to not include the EOL character.
        this.currentIndex += 1;

        return line;
    }

    /**
     * Returns the current position of this reader or -1 if there's nothing to
     * read.
     *
     * @returns - The current position or -1 if there's nothing to read.
     */
    public getCurrentPos(): number {
        return this.currentIndex;
    }

    /** @inheritdoc */
    public getDataLength(): number {
        return this.buffer.length;
    }
}
