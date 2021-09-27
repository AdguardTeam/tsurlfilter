/**
 * Line by line reader interface
 */
export interface ILineReader {
    /**
     * Reads the next line
     *
     * @return line string or null
     */
    readLine(): string| null;
}
