import { ILineReader } from './line-reader';

/**
 * Reads string line by line
 * TODO: This is kind of test implementation
 */
export class StringLineReader implements ILineReader {
    /**
     * Full string
     */
    private readonly text: string;

    /**
     * Current position
     */
    private currentIndex = 0;

    /**
     * Constructor
     *
     * @param text
     */
    constructor(text: string) {
        this.text = text;
    }

    /**
     * Reads next line
     *
     * @return text or null on end
     */
    public readLine(): string | null {
        // eslint-disable-next-line prefer-destructuring
        const length = this.text.length;
        let line = null;
        while (this.currentIndex < length) {
            const currentChar = this.text.charAt(this.currentIndex);
            this.currentIndex += 1;
            if (!line) {
                line = '';
            }

            line += currentChar;
            if (currentChar === '\n') {
                return line;
            }
        }

        return line;
    }
}
