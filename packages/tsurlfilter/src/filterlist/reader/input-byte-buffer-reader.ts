import {
    type AnyRule,
    FilterListParser,
    type InputByteBuffer,
    RuleParser,
} from '@adguard/agtree';
import { type ILineReader } from './line-reader';

export class InputBufferLineReader implements ILineReader<AnyRule> {
    private readonly inputByteBuffer: InputByteBuffer;

    /**
     * Number of children in the current node.
     * @private
     */
    private childrenCount: number | undefined;

    constructor(inputByteBuffer: InputByteBuffer) {
        this.inputByteBuffer = inputByteBuffer;
    }

    public readLine(): AnyRule | null {
        if (this.childrenCount === undefined) {
            this.childrenCount = FilterListParser.jumpToChildren(this.inputByteBuffer);
        }

        if (this.childrenCount) {
            let ruleNode: AnyRule;
            RuleParser.deserialize(this.inputByteBuffer, ruleNode = {} as AnyRule);

            if (ruleNode) {
                return ruleNode;
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
        return this.inputByteBuffer.currentOffset;
    }

    /** @inheritdoc */
    public getDataLength(): number {
        return this.inputByteBuffer.capacity;
    }
}
