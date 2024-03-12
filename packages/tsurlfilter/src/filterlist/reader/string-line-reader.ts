import { type ILineReader } from './line-reader';

/**
 * StringLineReader is a class responsible for reading content line by line
 * from a string.
 */
export class StringLineReader implements ILineReader {
    /**
     * Full string to read lines from.
     */
    private readonly text: string;

    /**
     * Current position of the line reader.
     */
    private currentIndex = 0;

    /**
     * Constructor of the StringLineReader.
     *
     * @param text - Text to read line by line.
     */
    constructor(text: string) {
        this.text = text;
    }

    /**
     * Reads next line in the reader.
     *
     * @return - Text or null if there's nothing to read left.
     */
    public readLine(): string | null {
        if (this.currentIndex === -1) {
            return null;
        }

        const startIndex = this.currentIndex;
        this.currentIndex = this.text.indexOf('\n', startIndex);

        if (this.currentIndex === -1) {
            return this.text.substring(startIndex);
        }

        // Increment to not include the EOL character.
        const line = this.text.substring(startIndex, this.currentIndex);

        this.currentIndex += 1;

        return line;
    }

    /**
     * Returns the current position of this reader or -1 if there's nothing to
     * read.
     *
     * @returns - The current position or -1.
     */
    public getCurrentPos(): number {
        return this.currentIndex;
    }
}
