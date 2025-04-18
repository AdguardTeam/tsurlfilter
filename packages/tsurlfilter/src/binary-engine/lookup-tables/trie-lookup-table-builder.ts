import { type RuleStorage } from '../../filterlist/rule-storage';
import { NetworkRule } from '../../rules/network-rule';
import { TrieNode } from '../../utils/trie';
import { SimpleRegex } from '../../rules/simple-regex';
import { ByteBuffer } from '../../utils/byte-buffer';
import { BinaryU32LinkedList } from '../../utils/binary-u32-linked-list';
import { BinaryTrie } from '../../utils/binary-trie';
import { type Builder } from '../builder';
import { TrieLookupTable } from './trie-lookup-table';
import { type IndexedStorageRule } from '../../rules/rule';

export class TrieLookupTableBuilder implements Builder<TrieLookupTable> {
    private built: boolean;

    private readonly buffer: ByteBuffer;

    private readonly storage: RuleStorage;

    private readonly trie: TrieNode;

    private rulesCount: number;

    constructor(storage: RuleStorage) {
        this.built = false;
        this.storage = storage;
        this.buffer = new ByteBuffer();
        this.trie = new TrieNode(0);
        this.rulesCount = 0;
    }

    /** @inheritdoc */
    public addRule(rule: IndexedStorageRule): boolean {
        if (this.built) {
            throw new Error('Cannot add rules after the lookup table has been built');
        }

        if (!(rule.rule instanceof NetworkRule)) {
            return false;
        }

        const shortcut = rule.rule.getShortcut();

        if (!shortcut || TrieLookupTableBuilder.isAnyURLShortcut(shortcut)
            || shortcut.length < SimpleRegex.MIN_SHORTCUT_LENGTH) {
            return false;
        }

        let storageIndexesPosition = this.trie.search(shortcut);

        if (storageIndexesPosition === -1) {
            storageIndexesPosition = BinaryU32LinkedList.create(this.buffer);
            this.trie.add(shortcut, storageIndexesPosition);
        }

        BinaryU32LinkedList.add(rule.index, this.buffer, storageIndexesPosition);
        this.rulesCount += 1;
        return true;
    }

    /**
     * Checks if the rule potentially matches too many URLs.
     * We'd better use another type of lookup table for this kind of rules.
     *
     * @param shortcut Shortcut to check.
     *
     * @returns True if the rule potentially matches too many URLs.
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

    public build(buffer: ByteBuffer): TrieLookupTable {
        if (this.built) {
            throw new Error('Cannot build the lookup table after it has been built');
        }

        const binaryTriePosition = BinaryTrie.create(this.trie, this.buffer);

        const offset = buffer.byteOffset;
        buffer.addUint32(offset, this.rulesCount);
        // binary trie position
        buffer.addUint32(offset + Uint32Array.BYTES_PER_ELEMENT, binaryTriePosition);
        buffer.addByteBuffer(this.buffer);
        this.built = true;
        return new TrieLookupTable(this.storage, buffer, offset);
    }
}
