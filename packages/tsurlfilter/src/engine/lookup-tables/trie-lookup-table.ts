import type { RuleStorage } from '../../filterlist/rule-storage';
import { Request } from '../../request';
import { NetworkRule } from '../../rules/network-rule';
import { TrieNode } from '../../utils/trie';
import { ILookupTable } from './lookup-table';
import { SimpleRegex } from '../../rules/simple-regex';
import { U32LinkedList } from '../../utils/u32-linked-list';
import type { ByteBuffer } from '../../utils/byte-buffer';
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
    declare private readonly byteBuffer: ByteBuffer;

    /**
     * Trie that stores rules' shortcuts.
     */
    private trie: TrieNode;

    /**
     * Rules counter offset position in the {@link byteBuffer}.
     *
     * @returns Buffer offset.
     */
    private get rulesCountPosition(): number {
        return this.offset;
    }

    /**
     * Pointer to binary trie position in the {@link byteBuffer}.
     *
     * @returns Buffer offset.
     */
    private get binaryTriePositionPtr(): number {
        return this.offset + 4; // Uint32Array.BYTES_PER_ELEMENT
    }

    /**
     * Count of loaded rules.
     *
     * @returns Count of loaded rules.
     */
    private get rulesCount(): number {
        return this.byteBuffer.getUint32(this.rulesCountPosition);
    }

    /**
     * Count of loaded rules.
     *
     * @param value Value to set.
     */
    private set rulesCount(value: number) {
        this.byteBuffer.setUint32(this.rulesCountPosition, value);
    }

    /**
     * Binary trie offset position in the {@link byteBuffer}.
     *
     * @returns The trie offset in the {@link byteBuffer}.
     */
    private get binaryTriePosition(): number {
        return this.byteBuffer.getUint32(this.binaryTriePositionPtr);
    }

    /**
     * Binary trie offset position in the {@link byteBuffer}.
     *
     * @param value Value to set.
     */
    private set binaryTriePosition(value: number) {
        this.byteBuffer.setUint32(this.binaryTriePositionPtr, value);
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
        this.byteBuffer = buffer;
        this.offset = offset;
        this.trie = new TrieNode(0);
    }

    /** @inheritdoc */
    public addRule(rule: NetworkRule, storageIdx: number): boolean {
        const shortcut = rule.getShortcut();

        if (!shortcut || TrieLookupTable.isAnyURLShortcut(shortcut)
            || shortcut.length < SimpleRegex.MIN_SHORTCUT_LENGTH) {
            return false;
        }

        let storageIndexesPosition = this.trie.search(shortcut);

        if (storageIndexesPosition === -1) {
            storageIndexesPosition = U32LinkedList.create(this.byteBuffer);
            this.trie.add(shortcut, storageIndexesPosition);
        }

        U32LinkedList.add(storageIdx, this.byteBuffer, storageIndexesPosition);
        this.rulesCount += 1;
        return true;
    }

    /** @inheritdoc */
    public getRulesCount(): number {
        return this.rulesCount;
    }

    /**
     * Build readonly index structure and write it in the {@link byteBuffer}.
     */
    public finalize() {
        this.binaryTriePosition = BinaryTrie.create(this.trie, this.byteBuffer);
    }

    /** @inheritdoc */
    public matchAll(request: Request): NetworkRule[] {
        const storageIndexesPositions = BinaryTrie.traverseAll(
            request.urlLowercase,
            request.urlLowercase.length,
            this.byteBuffer,
            this.binaryTriePosition,
        );

        const result: NetworkRule[] = [];

        for (let i = 0; i < storageIndexesPositions.length; i += 1) {
            const storageIndexesPosition = storageIndexesPositions[i];
            U32LinkedList.forEach((storageIdx) => {
                const rule = this.ruleStorage.retrieveNetworkRule(storageIdx);
                if (rule && rule.match(request, false)) {
                    result.push(rule);
                }
            }, this.byteBuffer, storageIndexesPosition);
        }

        return result;
    }

    /**
     * Allocate memory for the lookup table in the {@link byteBuffer} and return linked instance.
     *
     * @param storage Rule storage connected to lookup table.
     * @param buffer Shared linear memory buffer, which used for writing rule indexes data.
     * @returns Instance of {@link TrieLookupTable}.
     */
    public static create(
        storage: RuleStorage,
        buffer: ByteBuffer,
    ) {
        const offset = buffer.byteOffset;
        // allocate memory for counter
        buffer.addUint32(offset, 0);
        // allocate memory for binary trie position;
        buffer.addUint32(offset + 4, 0);

        return new TrieLookupTable(storage, buffer, offset);
    }

    /**
     * Checks if the rule potentially matches too many URLs.
     * We'd better use another type of lookup table for this kind of rules.
     *
     * @param shortcut To check.
     * @returns Check result.
     */
    private static isAnyURLShortcut(shortcut: string): boolean {
        // The numbers are basically ("PROTO://".length + 1)
        if (shortcut.length < 6 && shortcut.indexOf('ws:') === 0) {
            return true;
        }

        if (shortcut.length < 7 && shortcut.indexOf('|ws') === 0) {
            return true;
        }

        if (shortcut.length < 9 && shortcut.indexOf('http') === 0) {
            return true;
        }

        return !!(shortcut.length < 10 && shortcut.indexOf('|http') === 0);
    }
}
