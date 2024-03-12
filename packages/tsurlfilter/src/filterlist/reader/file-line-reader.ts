import fs from 'fs';
import { ILineReader } from './line-reader';
import { StringLineReader } from './string-line-reader';

/**
 * Reads file line by line
 */
export class FileLineReader implements ILineReader {
    /**
     * Temp implementation inner reader
     */
    private readonly innerReader: StringLineReader;

    /**
     * Constructor
     * @param path
     *
     * @throws
     */
    constructor(path: string) {
        const text = fs.readFileSync(path, 'utf8');
        this.innerReader = new StringLineReader(text);
    }

    /**
     * Reads next line
     */
    public readLine(): string | null {
        return this.innerReader.readLine();
    }
}
