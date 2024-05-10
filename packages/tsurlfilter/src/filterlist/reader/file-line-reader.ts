import fs from 'fs';
import { type ILineReader } from './line-reader';
import { BufferLineReader } from './buffer-line-reader';

/**
 * FileLineReader is a class responsible for reading file contents line by line.
 */
export class FileLineReader implements ILineReader {
    /**
     * FileLineReader relies on an internal BufferLineReader to provide the line
     * reading functionality.
     */
    private readonly innerReader: BufferLineReader;

    /**
     * Constructor of the FileLineReader.
     *
     * @param path - Path to the file to read.
     * @throws Error if the file cannot be read.
     */
    constructor(path: string) {
        const buffer = fs.readFileSync(path);
        this.innerReader = new BufferLineReader(buffer);
    }

    /**
     * Reads next line in the reader.
     */
    public readLine(): string | null {
        return this.innerReader.readLine();
    }

    /**
     * Returns the current position of this line reader.
     */
    getCurrentPos(): number {
        return this.innerReader.getCurrentPos();
    }

    /** @inheritdoc */
    getDataLength(): number {
        return this.innerReader.getDataLength();
    }
}
