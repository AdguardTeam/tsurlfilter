import { type ILookupTable } from './lookup-table';
import { type RuleStorage } from '../../filterlist/rule-storage';
import { type Request } from '../../request';
import { type NetworkRule } from '../../rules/network-rule';
import { fastHash } from '../../utils/string-utils';
import { SimpleRegex } from '../../rules/simple-regex';
import { type ByteBuffer } from '../../utils/byte-buffer';
import { U32LinkedList } from '../../utils/u32-linked-list';
import { BinaryMap } from '../../utils/binary-map';

/**
 * Hostname lookup table.
 * For specific kind of rules like '||hostname^' and '||hostname/path' more simple algorithm with hashes is faster.
 */
export class HostnameLookupTable implements ILookupTable {
    declare private readonly buffer: ByteBuffer;

    /** @inheritdoc */
    declare public readonly offset: number;

    /**
     * Domain lookup table. Key is the domain name hash.
     */
    private hostnameLookupTable = new Map<number, number>();

    /**
     * Storage for the network filtering rules.
     */
    private readonly ruleStorage: RuleStorage;

    /**
     * Creates a new instance.
     *
     * @param storage Rules storage. We store "rule indexes" in the lookup table which
     * can be used to retrieve the full rules from the storage.
     * @param buffer Buffer.
     * @param offset Offset.
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

    /**
     * Count of loaded rules.
     *
     * @returns Count of loaded rules.
     */
    private get rulesCount(): number {
        return this.buffer.getUint32(this.offset);
    }

    /**
     * Count of loaded rules.
     *
     * @param value Value to set.
     */
    private set rulesCount(value: number) {
        this.buffer.setUint32(this.offset, value);
    }

    /**
     * Binary map offset position in the {@link buffer}.
     *
     * @returns The map offset in the {@link buffer}.
     */
    private get binaryMapPosition(): number {
        return this.buffer.getUint32(this.offset + 4);
    }

    /**
     * Binary map offset position in the {@link buffer}.
     *
     * @param value Value to set.
     */
    private set binaryMapPosition(value: number) {
        this.buffer.setUint32(this.offset + 4, value);
    }

    /**
     * Implements the ILookupTable interface for DomainsLookupTable.
     *
     * @param rule Rule to add.
     * @param storageIdx Index of the rule in the storage.
     *
     * @returns True if the rule was added.
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
            storageIndexesPosition = U32LinkedList.create(this.buffer);
            this.hostnameLookupTable.set(hash, storageIndexesPosition);
        }

        // Add the storage index to the related U32LinkedList
        U32LinkedList.add(storageIdx, this.buffer, storageIndexesPosition);

        this.rulesCount += 1;
        return true;
    }

    /**
     * Implements the ILookupTable interface method.
     *
     * @returns The count of rules added to this lookup table.
     */
    getRulesCount(): number {
        return this.rulesCount;
    }

    /**
     * Implements the ILookupTable interface method.
     *
     * @param request The request to match against.
     *
     * @returns An array of matching network rules.
     */
    matchAll(request: Request): NetworkRule[] {
        const result: NetworkRule[] = [];
        const domains = request.subdomains;
        for (let i = 0; i < domains.length; i += 1) {
            const hash = fastHash(domains[i]);
            // Get the position of the storage indexes for the hash
            const storageIndexesPosition = BinaryMap.get(hash, this.buffer, this.binaryMapPosition);
            if (storageIndexesPosition !== undefined) {
                // Iterate over the storage indexes and retrieve the rules
                U32LinkedList.forEach((storageIdx) => {
                    const rule = this.ruleStorage.retrieveNetworkRule(storageIdx);

                    if (rule && rule.match(request)) {
                        result.push(rule);
                    }
                }, this.buffer, storageIndexesPosition);
            }
        }
        return result;
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

    /**
     * Build readonly index structure and write it in the {@link buffer}.
     */
    public finalize() {
        this.binaryMapPosition = BinaryMap.create(this.hostnameLookupTable, this.buffer);
    }

    /**
     * Allocate memory for the lookup table in the {@link buffer} and return linked instance.
     *
     * @param storage Rule storage connected to lookup table.
     * @param buffer Shared linear memory buffer, which used for writing rule indexes data.
     *
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
