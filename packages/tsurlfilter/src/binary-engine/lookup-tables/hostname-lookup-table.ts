import { type ILookupTable } from './lookup-table';
import { type RuleStorage } from '../../filterlist/rule-storage';
import { type Request } from '../../request';
import { type NetworkRule } from '../../rules/network-rule';
import { fastHash } from '../../utils/string-utils';
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
     * Binary map offset position in the {@link buffer}.
     *
     * @returns The map offset in the {@link buffer}.
     */
    private get binaryMapPosition(): number {
        return this.buffer.getUint32(this.offset + 4);
    }

    /**
     * Implements the ILookupTable interface method.
     *
     * @returns The count of rules added to this lookup table.
     */
    getRulesCount(): number {
        return this.buffer.getUint32(this.offset);
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
}
