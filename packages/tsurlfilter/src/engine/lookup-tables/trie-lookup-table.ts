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
 * Look up table with underlying prefix tree
 */
export class TrieLookupTable implements ILookupTable {
    /** @inheritdoc */
    declare public readonly offset: number;

    /**
     * Storage for the network filtering rules
     */
    declare private readonly ruleStorage: RuleStorage;

    declare private readonly byteBuffer: ByteBuffer;

    /**
     * Trie that stores rules' shortcuts.
     */
    private trie: TrieNode;

    private get ruleCountPosition(): number {
        return this.offset;
    }

    private get binaryTriePosition(): number {
        return this.offset + 4; // Uint32Array.BYTES_PER_ELEMENT
    }

    private get rulesCount(): number {
        return this.byteBuffer.getUint32(this.ruleCountPosition);
    }

    private set rulesCount(value: number) {
        this.byteBuffer.setUint32(this.ruleCountPosition, value);
    }

    private get binaryTrie(): number {
        return this.byteBuffer.getUint32(this.binaryTriePosition);
    }

    private set binaryTrie(value: number) {
        this.byteBuffer.setUint32(this.binaryTriePosition, value);
    }

    /**
     * Creates a new instance of the TrieLookupTable.
     *
     * @param storage rules storage. We store "rule indexes" in the lookup table which
     * can be used to retrieve the full rules from the storage.
     * @param buffer
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

    /**
     * Tries to add the rule to the lookup table.
     * returns true if it was added
     *
     * @param rule to add
     * @param storageIdx index
     * @return {boolean} true if the rule been added
     */
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
     * FIXME: description
     */
    public finalize() {
        this.binaryTrie = BinaryTrie.create(this.trie, this.byteBuffer);
    }

    /**
     * Traverses trie
     *
     * @param request
     */
    public matchAll(request: Request): NetworkRule[] {
        const storageIndexesPositions = BinaryTrie.traverseAll(
            request.urlLowercase,
            request.urlLowercase.length,
            this.byteBuffer,
            this.binaryTrie,
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
     * FIXME: description
     * @param storage
     * @param buffer
     * @returns
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
     * @param shortcut to check
     * @return check result
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
