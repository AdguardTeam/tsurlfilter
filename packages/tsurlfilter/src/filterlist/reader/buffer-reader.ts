import { type AnyRule, type InputByteBuffer } from '@adguard/agtree';
import { RuleDeserializer } from '@adguard/agtree/deserializer';

import { type IReader } from './reader';

/**
 * BufferReader is a class responsible for reading content from serialized rules.
 */
export class BufferReader implements IReader {
    /**
     * Input byte buffer.
     */
    private readonly buffer: InputByteBuffer;

    /**
     * Current position of the reader.
     */
    private currentIndex = 0;

    /**
     * Constructor of a BufferReader.
     *
     * @param buffer Uint8Array that contains a UTF-8 encoded string.
     */
    constructor(buffer: InputByteBuffer) {
        this.buffer = buffer;
        this.currentIndex = this.buffer.currentOffset;
    }

    /**
     * Reads the next line in the buffer.
     *
     * @returns Text or null on end.
     */
    public readNext(): AnyRule | null {
        // If the next byte is 0, it means that there's nothing to read.
        if (this.buffer.peekUint8() === 0) {
            return null;
        }

        let ruleNode: AnyRule;
        RuleDeserializer.deserialize(this.buffer, ruleNode = {} as AnyRule);

        this.currentIndex = this.buffer.currentOffset;

        if (ruleNode.category) {
            return ruleNode;
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
        return this.buffer.capacity;
    }
}
