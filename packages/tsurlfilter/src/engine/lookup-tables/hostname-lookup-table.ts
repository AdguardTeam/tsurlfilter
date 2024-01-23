import { ILookupTable } from './lookup-table';
import { RuleStorage } from '../../filterlist/rule-storage';
import { Request } from '../../request';
import { NetworkRule } from '../../rules/network-rule';
import { fastHash } from '../../utils/string-utils';
import { SimpleRegex } from '../../rules/simple-regex';
import { BinaryMap } from '../../utils/binary-map';
import { ByteBuffer } from '../../utils/byte-buffer';
import { U32LinkedList } from '../../utils/u32-linked-list';
import { StorageIndex } from '../../utils/storage-index';

/**
 * Hostname lookup table.
 * For specific kind of rules like '||hostname^' and '||hostname/path' more simple algorithm with hashes is faster.
 */
export class HostnameLookupTable implements ILookupTable {
    /**
     * Count of rules added to this lookup table.
     */
    private rulesCount = 0;

    /**
     * Domain lookup table. Key is the domain name hash.
     */
    private hostnameLookupTable = new Map<number, number>();

    /**
     * Storage for the network filtering rules
     */
    private readonly ruleStorage: RuleStorage;

    private readonly byteBuffer: ByteBuffer;

    private readonly storageIndexesList: U32LinkedList;

    /**
     * Creates a new instance
     *
     * @param storage rules storage. We store "rule indexes" in the lookup table which
     * can be used to retrieve the full rules from the storage.
     */
    constructor(storage: RuleStorage, buffer: ByteBuffer) {
        this.ruleStorage = storage;
        this.byteBuffer = buffer;
        this.storageIndexesList = U32LinkedList.create(this.byteBuffer);
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

        // Add the rule to the lookup table
        const storageIndex = StorageIndex.create(this.byteBuffer, storageIdx);
        const storageIndexesPosition = this.hostnameLookupTable.get(hash);

        if (storageIndexesPosition === undefined) {
            const storageIndexes = U32LinkedList.create(this.byteBuffer);
            storageIndexes.add(storageIndex.offset);
            this.storageIndexesList.add(storageIndexes.offset);
            this.hostnameLookupTable.set(hash, storageIndexes.offset);
        } else {
            const storageIndexes = new U32LinkedList(this.byteBuffer, storageIndexesPosition);
            storageIndexes.add(storageIndex.offset);
        }

        this.rulesCount += 1;
        return true;
    }

    /**
     * Implements the ILookupTable interface method.
     */
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
            const storageIndexesPosition = this.hostnameLookupTable.get(hash);
            if (storageIndexesPosition !== undefined) {
                const storageIndexes = new U32LinkedList(this.byteBuffer, storageIndexesPosition);

                storageIndexes.forEach((storageIndexPosition) => {
                    const storageIndex = new StorageIndex(this.byteBuffer, storageIndexPosition);

                    const rule = this.ruleStorage.retrieveNetworkRule(storageIndex.value);

                    if (rule && rule.match(request)) {
                        result.push(rule);
                    }
                });
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
        // TODO: fix typing
        this.hostnameLookupTable = new BinaryMap(
            this.hostnameLookupTable,
            this.byteBuffer,
            this.byteBuffer.byteOffset,
        ) as unknown as Map<number, number>;
    }
}
