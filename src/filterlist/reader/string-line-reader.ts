import { ILineReader } from './line-reader';

/**
 * Reads string line by line
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
        if (this.currentIndex === -1) {
            return null;
        }

        const startIndex = this.currentIndex === 0 ? 0 : this.currentIndex + 1;
        this.currentIndex = this.text.indexOf('\n', startIndex);
        if (this.currentIndex === -1) {
            return this.text.substring(startIndex);
        }

        return this.text.substring(startIndex, this.currentIndex);
    }
}
