import { type RuleStorage } from '../../filterlist/rule-storage';
import { NetworkRule } from '../../rules/network-rule';
import { fastHash } from '../../utils/string-utils';
import { SimpleRegex } from '../../rules/simple-regex';
import { ByteBuffer } from '../../utils/byte-buffer';
import { U32LinkedList } from '../../utils/u32-linked-list';
import { type Builder } from '../builder';
import { HostnameLookupTable } from './hostname-lookup-table';
import { type IndexedStorageRule } from '../../rules/rule';

export class HostnameLookupTableBuilder implements Builder<HostnameLookupTable> {
    private built: boolean;

    private readonly buffer: ByteBuffer;

    private readonly storage: RuleStorage;

    private readonly hostnameLookupTable: Map<number, number>;

    private rulesCount: number;

    constructor(storage: RuleStorage) {
        this.built = false;
        this.storage = storage;
        this.buffer = new ByteBuffer();
        this.hostnameLookupTable = new Map<number, number>();
        this.rulesCount = 0;
    }

    public addRule(rule: IndexedStorageRule): boolean {
        if (this.built) {
            throw new Error('Cannot add rules after the lookup table has been built');
        }

        if (!(rule.rule instanceof NetworkRule)) {
            return false;
        }

        const pattern = rule.rule.getPattern();
        let hostname = '';

        // Pattern: '||example.org^'
        if (pattern.startsWith(SimpleRegex.MASK_START_URL) && pattern.endsWith(SimpleRegex.MASK_SEPARATOR)) {
            hostname = pattern.slice(
                SimpleRegex.MASK_START_URL.length,
                pattern.length - SimpleRegex.MASK_SEPARATOR.length,
            );
        }

        // Pattern: '||example.org/path'
        if (pattern.startsWith(SimpleRegex.MASK_START_URL) && pattern.indexOf(SimpleRegex.MASK_BACKSLASH) !== -1) {
            const end = pattern.indexOf(SimpleRegex.MASK_BACKSLASH);
            hostname = pattern.slice(SimpleRegex.MASK_START_URL.length, end);
        }

        if (!HostnameLookupTableBuilder.isValidHostname(hostname)) {
            return false;
        }

        const hash = fastHash(hostname);

        // Get the position of the storage indexes for the hash
        let storageIndexesPosition = this.hostnameLookupTable.get(hash);

        /**
         * If the hash is not in the lookup table, create a new {@link U32LinkedList}.
         */
        if (storageIndexesPosition === undefined) {
            storageIndexesPosition = U32LinkedList.create(this.buffer);
            this.hostnameLookupTable.set(hash, storageIndexesPosition);
        }

        // Add the storage index to the related U32LinkedList
        U32LinkedList.add(rule.index, this.buffer, storageIndexesPosition);

        this.rulesCount += 1;
        return true;
    }

    /**
     * Checks if this hostname string is valid.
     *
     * @param hostname Hostname to check.
     *
     * @returns True if the hostname is valid.
     */
    private static isValidHostname(hostname: string): boolean {
        if (!hostname) {
            return false;
        }

        if (hostname.indexOf(SimpleRegex.MASK_ANY_CHARACTER) !== -1) {
            return false;
        }

        if (hostname.indexOf('.') < 0 || hostname.endsWith('.')) {
            return false;
        }

        return true;
    }

    public build(buffer: ByteBuffer): HostnameLookupTable {
        if (this.built) {
            throw new Error('Cannot build the lookup table after it has been built');
        }

        const offset = buffer.byteOffset;
        buffer.addUint32(offset, this.rulesCount);
        // FIXME
        buffer.addUint32(offset + Uint32Array.BYTES_PER_ELEMENT, 0);
        buffer.addByteBuffer(this.buffer);
        this.built = true;
        return new HostnameLookupTable(this.storage, buffer, offset);
    }
}
