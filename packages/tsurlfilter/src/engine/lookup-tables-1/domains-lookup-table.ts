import { type ILookupTable } from './lookup-table';
import { type RuleStorage } from '../../filterlist/rule-storage';
import { type Request } from '../../request';
import { DomainModifier } from '../../modifiers/domain-modifier';
import { fastHash } from '../../utils/string-utils';
import { type NetworkRule } from '../../rules/network-rule';
import { type ByteBuffer } from '../../utils/byte-buffer';
import { U32LinkedList } from '../../utils/u32-linked-list';
import { BinaryMap } from '../../utils/binary-map';

/**
 * Domain lookup table. Key is the domain name hash.
 */
export class DomainsLookupTable implements ILookupTable {
    /** @inheritdoc */
    declare public readonly offset: number;

    /**
     * Domain lookup table. Key is the domain name hash.
     */
    private domainsLookupTable = new Map<number, number>();

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
     * Binary map offset position in the {@link byteBuffer}.
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
        const permittedDomains = rule.getPermittedDomains();
        if (!permittedDomains || permittedDomains.length === 0) {
            return false;
        }

        if (permittedDomains.some(DomainModifier.isWildcardOrRegexDomain)) {
            return false;
        }

        permittedDomains.forEach((domain) => {
            const hash = fastHash(domain);

            // Get the position of the storage indexes for the hash
            let storageIndexesPosition = this.domainsLookupTable.get(hash);

            /**
             * If the hash is not in the lookup table, create a new {@link U32LinkedList}.
             */
            if (storageIndexesPosition === undefined) {
                storageIndexesPosition = U32LinkedList.create(this.buffer);
                this.domainsLookupTable.set(hash, storageIndexesPosition);
            }

            // Add the storage index to the related U32LinkedList
            U32LinkedList.add(storageIdx, this.buffer, storageIndexesPosition);
        });

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
     * Build readonly index structure and write it in the {@link buffer}.
     */
    public finalize(): void {
        this.binaryMapPosition = BinaryMap.create(this.domainsLookupTable, this.buffer);
    }

    /**
     * Allocate memory for the lookup table in the {@link buffer} and return linked instance.
     *
     * @param storage Rule storage connected to lookup table.
     * @param buffer Shared linear memory buffer, which used for writing rule indexes data.
     *
     * @returns Instance of {@link DomainsLookupTable}.
     */
    public static create(
        storage: RuleStorage,
        buffer: ByteBuffer,
    ): DomainsLookupTable {
        const offset = buffer.byteOffset;
        buffer.addUint32(offset, 0);
        buffer.addUint32(offset + Uint32Array.BYTES_PER_ELEMENT, 0);
        return new DomainsLookupTable(storage, buffer, offset);
    }
}
