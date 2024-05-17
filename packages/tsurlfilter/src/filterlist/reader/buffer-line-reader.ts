import {
    type AnyRule,
    FilterListParser,
    type InputByteBuffer,
    RuleParser,
} from '@adguard/agtree';
import { type ILineReader } from './line-reader';

/**
 * BufferLineReader is a class responsible for reading content line by line
 * from a bytes buffer with a UTF-8 encoded string.
 */
export class BufferLineReader<T extends string | AnyRule = string> implements ILineReader<T> {
    /**
     * EOL is a new line character that is used to detect line endings. We only
     * rely on \n and not \r so the lines need to be trimmed after processing.
     */
    public static readonly EOL = '\n'.charCodeAt(0);

    /**
     * Byte buffer with a UTF-8 encoded string.
     */
    private readonly buffer: Uint8Array | InputByteBuffer;

    /**
     * Current position of the reader.
     */
    private currentIndex = 0;

    /**
     * Text decoder that is used to read strings from the internal buffer of
     * UTF-8 encoded characters.
     */
    private static readonly decoder = new TextDecoder('utf-8');

    /**
     * Number of children in the current node.
     * @private
     */
    private childrenCount: number | undefined;

    /**
     * Constructor of a BufferLineReader.
     *
     * @param buffer - Uint8Array that contains a UTF-8 encoded string.
     */
    constructor(buffer: Uint8Array | InputByteBuffer) {
        this.buffer = buffer;
    }

    /**
     * Reads the next line in the buffer
     *
     * @return text or null on end
     */
    public readLine(): T | null {
        if (this.buffer instanceof Uint8Array) {
            if (this.currentIndex === -1) {
                return null;
            }

            const startIndex = this.currentIndex;
            this.currentIndex = this.buffer.indexOf(BufferLineReader.EOL, startIndex);

            if (this.currentIndex === -1) {
                return BufferLineReader.decoder.decode(this.buffer.subarray(startIndex)) as T;
            }

            const lineBytes = this.buffer.subarray(startIndex, this.currentIndex);
            const line = BufferLineReader.decoder.decode(lineBytes);

            // Increment to not include the EOL character.
            this.currentIndex += 1;

            return line as T;
        }

        if (this.childrenCount === undefined) {
            this.childrenCount = FilterListParser.jumpToChildren(this.buffer);
        }

        if (this.childrenCount) {
            let ruleNode: AnyRule;
            RuleParser.deserialize(this.buffer, ruleNode = {} as AnyRule);

            if (ruleNode) {
                return ruleNode as T;
            }

            this.childrenCount -= 1;
        }

        return null;
    }

    /**
     * Returns the current position of this reader or -1 if there's nothing to
     * read.
     *
     * @returns - The current position or -1 if there's nothing to read.
     */
    public getCurrentPos(): number {
        return this.currentIndex;
    }

    /** @inheritdoc */
    public getDataLength(): number {
        if (this.buffer instanceof Uint8Array) {
            return this.buffer.length;
        }

        return this.buffer.capacity;
    }
}
