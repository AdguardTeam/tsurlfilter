/**
 * Line by line reader interface.
 */
export interface ILineReader {
    /**
     * Reads the next line.
     *
     * @returns Line string or null.
     */
    readLine(): string | null;

    /**
     * Returns the current position of this line reader.
     *
     * @returns Current position.
     */
    getCurrentPos(): number;

    /**
     * Returns the current line number.
     *
     * @returns Current line number. 1-based.
     */
    getCurrentLineNumber(): number;

    /**
     * Returns the length of the data.
     *
     * @returns Data length.
     */
    getDataLength(): number;
}
