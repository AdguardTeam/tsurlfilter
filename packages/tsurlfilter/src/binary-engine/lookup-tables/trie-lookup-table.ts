import { type RuleStorage } from '../../filterlist/rule-storage';
import { type Request } from '../../request';
import { type NetworkRule } from '../../rules/network-rule';
import { type ILookupTable } from './lookup-table';
import { type ByteBuffer } from '../../utils/byte-buffer';
import { BinaryU32LinkedList } from '../../utils/binary-u32-linked-list';
import { BinaryTrie } from '../../utils/binary-trie';

/**
 * Look up table with underlying prefix tree.
 */
export class TrieLookupTable implements ILookupTable {
    /** @inheritdoc */
    declare public readonly offset: number;

    /**
     * Storage for the network filtering rules.
     */
    declare private readonly ruleStorage: RuleStorage;

    /**
     * ByteBuffer to store the binary data.
     */
    declare private readonly buffer: ByteBuffer;

    /**
     * Binary trie offset position in the {@link buffer}.
     *
     * @returns The trie offset in the {@link buffer}.
     */
    private get binaryTriePosition(): number {
        return this.buffer.getUint32(this.binaryTriePositionPtr);
    }

    /**
     * Rules counter offset position in the {@link buffer}.
     *
     * @returns Buffer offset.
     */
    private get rulesCountPosition(): number {
        return this.offset;
    }

    /**
     * Pointer to binary trie position in the {@link buffer}.
     *
     * @returns Buffer offset.
     */
    private get binaryTriePositionPtr(): number {
        return this.offset + 4; // Uint32Array.BYTES_PER_ELEMENT
    }

    /**
     * Creates a new instance.
     *
     * @param storage Rules storage. We store "rule indexes" in the lookup table which can be used
     * to retrieve the full rules from the storage.
     * @param buffer Byte buffer to store the binary data.
     * @param offset Byte offset of the lookup table in the {@link buffer}.
     */
    constructor(
        storage: RuleStorage,
        buffer: ByteBuffer,
        offset: number,
    ) {
        this.ruleStorage = storage;
        this.buffer = buffer;
        this.offset = offset;
    }

    /** @inheritdoc */
    public matchAll(request: Request): NetworkRule[] {
        const storageIndexesPositions = BinaryTrie.traverseAll(
            request.urlLowercase,
            request.urlLowercase.length,
            this.buffer,
            this.binaryTriePosition,
        );

        const result: NetworkRule[] = [];

        for (let i = 0; i < storageIndexesPositions.length; i += 1) {
            const storageIndexesPosition = storageIndexesPositions[i];
            BinaryU32LinkedList.forEach((storageIdx) => {
                const rule = this.ruleStorage.retrieveNetworkRule(storageIdx);
                if (rule && rule.match(request, false)) {
                    result.push(rule);
                }
            }, this.buffer, storageIndexesPosition);
        }

        return result;
    }

    /**
     * Returns total rules count.
     *
     * @returns Total rules count.
     */
    public getRulesCount(): number {
        return this.buffer.getUint32(this.rulesCountPosition);
    }
}
