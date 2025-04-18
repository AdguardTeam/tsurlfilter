import { type ILookupTable } from './lookup-table';
import { type RuleStorage } from '../../filterlist/rule-storage';
import { type Request } from '../../request';
import { fastHash } from '../../utils/string-utils';
import { type NetworkRule } from '../../rules/network-rule';
import { type ByteBuffer } from '../../utils/byte-buffer';
import { U32LinkedList } from '../../utils/u32-linked-list';
import { BinaryUint32ToUint32Map } from '../../utils/binary-uint32-to-uint32-map';

/**
 * Domain lookup table. Key is the domain name hash.
 */
export class DomainsLookupTable implements ILookupTable {
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
     * Creates a new instance.
     *
     * @param storage Rules storage. We store "rule indexes" in the lookup table which
     * can be used to retrieve the full rules from the storage.
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
    public getRulesCount(): number {
        return this.buffer.getUint32(this.offset);
    }

    /**
     * Implements the ILookupTable interface method.
     *
     * @param request Request to check.
     *
     * @returns Array of matching network rules.
     */
    matchAll(request: Request): NetworkRule[] {
        const result: NetworkRule[] = [];

        if (!request.sourceHostname) {
            return result;
        }

        const domains = [...request.subdomains];
        if (request.hostname !== request.sourceHostname) {
            domains.push(...request.sourceSubdomains);
        }

        for (let i = 0; i < domains.length; i += 1) {
            const hash = fastHash(domains[i]);
            // Get the position of the storage indexes for the hash
            const storageIndexesPosition = BinaryUint32ToUint32Map.get(hash, this.buffer, this.binaryMapPosition);
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
