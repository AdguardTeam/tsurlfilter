/**
 * Line by line reader interface
 */
// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface ILineReader {
    /**
     * Reads the next line
     *
     * @return line string or null
     */
    readLine(): string| null;
}
