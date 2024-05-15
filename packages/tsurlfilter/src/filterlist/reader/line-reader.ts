/**
 * Line by line reader interface
 */
// FIXME (David): Rename it to `IReader`
export interface ILineReader<T = string> {
    /**
     * Reads the next line.
     *
     * @return line string or null.
     */
    // FIXME (David): Rename it to `readNext`
    readLine(): T | null;

    /**
     * Returns the current position of this line reader.
     */
    getCurrentPos(): number;

    /**
     * Returns the length of the data.
     */
    getDataLength(): number;
}
