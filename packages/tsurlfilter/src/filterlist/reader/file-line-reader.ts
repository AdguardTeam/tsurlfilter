import { readFileSync } from 'node:fs';

import { type ILineReader } from './line-reader';
import { BufferLineReader } from './buffer-line-reader';

/**
 * FileLineReader is a class responsible for reading file contents line by line.
 * It supports LF (`\n`) and CRLF (`\r\n`) line breaks.
 */
export class FileLineReader implements ILineReader {
    /**
     * FileLineReader relies on an internal BufferLineReader to provide the line
     * reading functionality.
     */
    private readonly innerReader: BufferLineReader;

    /**
     * Constructor of the `FileLineReader`.
     *
     * @param path Path to the file to read.
     *
     * @throws Error if the file cannot be read.
     */
    constructor(path: string) {
        const buffer = readFileSync(path);
        this.innerReader = new BufferLineReader(buffer);
    }

    /** @inheritdoc */
    public readLine(): string | null {
        return this.innerReader.readLine();
    }

    /** @inheritdoc */
    public getCurrentPos(): number {
        return this.innerReader.getCurrentPos();
    }

    /** @inheritdoc */
    public getCurrentLineNumber(): number {
        return this.innerReader.getCurrentLineNumber();
    }

    /** @inheritdoc */
    public getDataLength(): number {
        return this.innerReader.getDataLength();
    }
}
