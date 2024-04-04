import { ILookupTable } from './lookup-table';
import { RuleStorage } from '../../filterlist/rule-storage';
import { Request } from '../../request';
import { NetworkRule } from '../../rules/network-rule';
import { fastHash } from '../../utils/string-utils';
import { SimpleRegex } from '../../rules/simple-regex';
import { BinaryMap } from '../../utils/binary-map';
import { ByteBuffer } from '../../utils/byte-buffer';
import { U32LinkedList } from '../../utils/u32-linked-list';

/**
 * Hostname lookup table.
 * For specific kind of rules like '||hostname^' and '||hostname/path' more simple algorithm with hashes is faster.
 */
export class HostnameLookupTable implements ILookupTable {
    /**
     * Domain lookup table. Key is the domain name hash.
     */
    private hostnameLookupTable = new Map<number, number>();

    /**
     * Storage for the network filtering rules
     */
    declare private readonly ruleStorage: RuleStorage;

    /**
     * ByteBuffer to store the binary data.
     */
    declare private readonly byteBuffer: ByteBuffer;

    /**
     * Position of the binary map in the byte buffer.
     */
    declare private binaryMapPosition: number;

    declare private ruleCountPosition: number;

    private get rulesCount(): number {
        return this.byteBuffer.getUint32(this.ruleCountPosition);
    }

    private set rulesCount(value: number) {
        this.byteBuffer.setUint32(this.ruleCountPosition, value);
    }

    /**
     * Creates a new instance
     *
     * @param storage rules storage. We store "rule indexes" in the lookup table which
     * can be used to retrieve the full rules from the storage.
     */
    constructor(storage: RuleStorage, buffer: ByteBuffer) {
        this.ruleStorage = storage;
        this.byteBuffer = buffer;
        this.pushRulesCountToBuffer();
    }

    /**
     * addRule implements the ILookupTable interface for DomainsLookupTable.
     * @param rule
     * @param storageIdx
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

        // Add storage index to the byte buffer
        const storageIndexPosition = this.byteBuffer.byteOffset;
        this.byteBuffer.addStorageIndex(storageIndexPosition, storageIdx);

        // Get the position of the storage indexes for the hash
        let storageIndexesPosition = this.hostnameLookupTable.get(hash);

        /**
         * If the hash is not in the lookup table, create a new {@link U32LinkedList},
         */
        if (storageIndexesPosition === undefined) {
            storageIndexesPosition = U32LinkedList.create(this.byteBuffer);
            this.hostnameLookupTable.set(hash, storageIndexesPosition);
        }

        // Add the position of the storage index to the related U32LinkedList
        U32LinkedList.add(storageIndexPosition, this.byteBuffer, storageIndexesPosition);

        this.rulesCount += 1;
        return true;
    }

    /** @inheritdoc */
    getRulesCount(): number {
        return this.rulesCount;
    }

    /**
     * Implements the ILookupTable interface method.
     * @param request
     */
    matchAll(request: Request): NetworkRule[] {
        const result: NetworkRule[] = [];
        const domains = request.subdomains;
        for (let i = 0; i < domains.length; i += 1) {
            const hash = fastHash(domains[i]);
            // Get the position of the storage indexes for the hash
            const storageIndexesPosition = BinaryMap.get(hash, this.byteBuffer, this.binaryMapPosition);
            if (storageIndexesPosition !== undefined) {
                // Iterate over the storage indexes and retrieve the rules
                U32LinkedList.forEach((storageIndexPosition) => {
                    const ruleId = this.byteBuffer.getUint32(storageIndexPosition);
                    const listId = this.byteBuffer.getUint32(storageIndexPosition + 4);

                    const rule = this.ruleStorage.retrieveNetworkRule(listId, ruleId);

                    if (rule && rule.match(request)) {
                        result.push(rule);
                    }
                }, this.byteBuffer, storageIndexesPosition);
            }
        }
        return result;
    }

    /**
     * Checks if this hostname string is valid
     *
     * @param hostname
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

    finalize() {
        this.binaryMapPosition = BinaryMap.create(this.hostnameLookupTable, this.byteBuffer);
    }

    private pushRulesCountToBuffer() {
        this.ruleCountPosition = this.byteBuffer.byteOffset;
        this.byteBuffer.addUint32(this.ruleCountPosition, 0);
    }
}
