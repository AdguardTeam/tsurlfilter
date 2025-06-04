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
     */
    getCurrentPos(): number;

    /**
     * Returns the length of the data.
     */
    getDataLength(): number;
}
