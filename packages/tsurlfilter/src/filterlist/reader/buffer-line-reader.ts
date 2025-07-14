import { CR, LF } from '../../common/constants';
import { type ILineReader } from './line-reader';

/**
 * BufferLineReader is a class responsible for reading content line by line
 * from a bytes buffer with a UTF-8 encoded string. It supports LF (`\n`) and CRLF (`\r\n`) line breaks.
 */
export class BufferLineReader implements ILineReader {
    /**
     * LF character code.
     */
    private static readonly LF = LF.charCodeAt(0);

    /**
     * CR character code.
     */
    private static readonly CR = CR.charCodeAt(0);

    /**
     * Byte buffer with a UTF-8 encoded string.
     */
    private readonly buffer: Uint8Array;

    /**
     * Current position of the reader.
     */
    private currentIndex = 0;

    /**
     * Current line number (1-based).
     */
    private currentLineNumber = 1;

    /**
     * Text decoder that is used to read strings from the internal buffer of
     * UTF-8 encoded characters.
     */
    private static readonly decoder = new TextDecoder('utf-8');

    /**
     * Constructor of a the `BufferLineReader`.
     *
     * @param buffer Uint8Array that contains a UTF-8 encoded string.
     */
    constructor(buffer: Uint8Array) {
        this.buffer = buffer;
    }

    /** @inheritdoc */
    public readLine(): string | null {
        if (this.currentIndex === -1 || this.currentIndex >= this.buffer.length) {
            this.currentIndex = -1;
            return null;
        }

        const startIndex = this.currentIndex;
        const lfIndex = this.buffer.indexOf(BufferLineReader.LF, startIndex);

        if (lfIndex === -1) {
            // No more line breaks
            const line = BufferLineReader.decoder.decode(this.buffer.subarray(startIndex));
            this.currentIndex = -1;
            this.currentLineNumber += 1;
            return line;
        }

        // Check if the LF is preceded by CR (i.e., CRLF)
        let lineBytes: Uint8Array;
        if (lfIndex > 0 && this.buffer[lfIndex - 1] === BufferLineReader.CR) {
            // CRLF: include \r in the break
            lineBytes = this.buffer.subarray(startIndex, lfIndex - 1);
        } else {
            // LF only
            lineBytes = this.buffer.subarray(startIndex, lfIndex);
        }

        const line = BufferLineReader.decoder.decode(lineBytes);

        this.currentIndex = lfIndex + 1;
        this.currentLineNumber += 1;

        return line;
    }

    /** @inheritdoc */
    public getCurrentPos(): number {
        return this.currentIndex;
    }

    /** @inheritdoc */
    public getCurrentLineNumber(): number {
        return this.currentLineNumber;
    }

    /** @inheritdoc */
    public getDataLength(): number {
        return this.buffer.length;
    }
}
