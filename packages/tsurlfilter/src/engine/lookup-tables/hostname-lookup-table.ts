import type { ILookupTable } from './lookup-table';
import type { RuleStorage } from '../../filterlist/rule-storage';
import type { Request } from '../../request';
import type { NetworkRule } from '../../rules/network-rule';
import type { ByteBuffer } from '../../utils/byte-buffer';
import { fastHash } from '../../utils/string-utils';
import { SimpleRegex } from '../../rules/simple-regex';
import { BinaryMap } from '../../utils/binary-map';
import { U32LinkedList } from '../../utils/u32-linked-list';

/**
 * Hostname lookup table.
 * For specific kind of rules like '||hostname^' and '||hostname/path' more simple algorithm with hashes is faster.
 */
export class HostnameLookupTable implements ILookupTable {
    /** @inheritdoc */
    declare public readonly offset: number;

    /**
     * Domain lookup table. Key is the domain name hash.
     */
    private hostnameLookupTable = new Map<number, number>();

    /**
     * Storage for the network filtering rules.
     */
    declare private readonly ruleStorage: RuleStorage;

    /**
     * ByteBuffer to store the binary data.
     */
    declare private readonly byteBuffer: ByteBuffer;

    /**
     * Count of loaded rules.
     *
     * @returns Count of loaded rules.
     */
    private get rulesCount(): number {
        return this.byteBuffer.getUint32(this.offset);
    }

    /**
     * Count of loaded rules.
     *
     * @param value Value to set.
     */
    private set rulesCount(value: number) {
        this.byteBuffer.setUint32(this.offset, value);
    }

    /**
     * Binary map offset position in the {@link byteBuffer}.
     *
     * @returns The map offset in the {@link byteBuffer}.
     */
    private get binaryMapPosition(): number {
        return this.byteBuffer.getUint32(this.offset + 4);
    }

    /**
     * Binary map offset position in the {@link byteBuffer}.
     *
     * @param value Value to set.
     */
    private set binaryMapPosition(value: number) {
        this.byteBuffer.setUint32(this.offset + 4, value);
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
    }

    /**
     * Implements the ILookupTable interface for DomainsLookupTable.
     *
     * @param rule Rule to add.
     * @param storageIdx Rule storage index.
     * @returns True if rule is added to lookup table, otherwise false.
     */
    addRule(rule: NetworkRule, storageIdx: number): boolean {
        const pattern = rule.getPattern();
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

        if (!HostnameLookupTable.isValidHostname(hostname)) {
            return false;
        }

        const hash = fastHash(hostname);

        // Get the position of the storage indexes for the hash
        let storageIndexesPosition = this.hostnameLookupTable.get(hash);

        /**
         * If the hash is not in the lookup table, create a new {@link U32LinkedList}.
         */
        if (storageIndexesPosition === undefined) {
            storageIndexesPosition = U32LinkedList.create(this.byteBuffer);
            this.hostnameLookupTable.set(hash, storageIndexesPosition);
        }

        // Add the storage index to the related U32LinkedList
        U32LinkedList.add(storageIdx, this.byteBuffer, storageIndexesPosition);

        this.rulesCount += 1;
        return true;
    }

    /** @inheritdoc */
    getRulesCount(): number {
        return this.rulesCount;
    }

    /** @inheritdoc */
    matchAll(request: Request): NetworkRule[] {
        const result: NetworkRule[] = [];
        const domains = request.subdomains;
        for (let i = 0; i < domains.length; i += 1) {
            const hash = fastHash(domains[i]);
            // Get the position of the storage indexes for the hash
            const storageIndexesPosition = BinaryMap.get(hash, this.byteBuffer, this.binaryMapPosition);
            if (storageIndexesPosition !== undefined) {
                // Iterate over the storage indexes and retrieve the rules
                U32LinkedList.forEach((storageIdx) => {
                    const rule = this.ruleStorage.retrieveNetworkRule(storageIdx);

                    if (rule && rule.match(request)) {
                        result.push(rule);
                    }
                }, this.byteBuffer, storageIndexesPosition);
            }
        }
        return result;
    }

    /**
     * Checks if this hostname string is valid.
     *
     * @param hostname Hostname string.
     * @returns True if hostname is valid, otherwise false.
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

    /**
     * Build readonly index structure and write it in the {@link byteBuffer}.
     */
    public finalize() {
        this.binaryMapPosition = BinaryMap.create(this.hostnameLookupTable, this.byteBuffer);
    }

    /**
     * Allocate memory for the lookup table in the {@link byteBuffer} and return linked instance.
     *
     * @param storage Rule storage connected to lookup table.
     * @param buffer Shared linear memory buffer, which used for writing rule indexes data.
     * @returns Instance of {@link HostnameLookupTable}.
     */
    public static create(
        storage: RuleStorage,
        buffer: ByteBuffer,
    ): HostnameLookupTable {
        const offset = buffer.byteOffset;
        buffer.addUint32(offset, 0);
        buffer.addUint32(offset + Uint32Array.BYTES_PER_ELEMENT, 0);
        return new HostnameLookupTable(storage, buffer, offset);
    }
}
