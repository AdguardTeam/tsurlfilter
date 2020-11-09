import { ILineReader } from './line-reader';

/**
 * Reads string line by line
 */
export class StringLineReader implements ILineReader {
    /**
     * Lines array
     */
    private readonly lines: string[];

    /**
     * Current line index
     */
    private currentLineIndex = 0;

    /**
     * Constructor
     *
     * @param text
     */
    constructor(text: string) {
        this.lines = text.split('\n');
    }

    /**
     * Reads next line
     *
     * @return text or null on end
     */
    public readLine(): string | null {
        if (this.currentLineIndex > this.lines.length) {
            return null;
        }

        const line = this.lines[this.currentLineIndex];
        this.currentLineIndex += 1;

        return line;
    }
}
