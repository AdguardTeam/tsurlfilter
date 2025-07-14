import { CR, LF } from '../../common/constants';
import { type ILineReader } from './line-reader';

/**
 * StringLineReader is a class responsible for reading content line by line
 * from a string. It supports LF (`\n`) and CRLF (`\r\n`) line breaks.
 */
export class StringLineReader implements ILineReader {
    /**
     * Full string to read lines from.
     */
    private readonly text: string;

    /**
     * Current read position or -1 when the reader is finished.
     */
    private currentIndex = 0;

    /**
     * Line number, 1-based.
     */
    private currentLineNumber = 1;

    /**
     * Constructor of the `StringLineReader`.
     *
     * @param text Text to read line by line.
     */
    constructor(text: string) {
        this.text = text;
    }

    /** @inheritdoc */
    public readLine(): string | null {
        if (this.currentIndex === -1 || this.currentIndex >= this.text.length) {
            this.currentIndex = -1;
            return null;
        }

        const startIndex = this.currentIndex;
        const lfIndex = this.text.indexOf(LF, startIndex);

        if (lfIndex === -1) {
            const line = this.text.substring(startIndex);
            this.currentIndex = -1;
            this.currentLineNumber += 1;
            return line;
        }

        let line: string;
        if (lfIndex > 0 && this.text[lfIndex - 1] === CR) {
            // CRLF: include \r in the break
            line = this.text.substring(startIndex, lfIndex - 1);
        } else {
            // LF only
            line = this.text.substring(startIndex, lfIndex);
        }

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
        return this.text.length;
    }
}
