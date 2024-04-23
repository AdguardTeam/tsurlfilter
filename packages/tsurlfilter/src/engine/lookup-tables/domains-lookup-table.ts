import type { ILookupTable } from './lookup-table';
import type { RuleStorage } from '../../filterlist/rule-storage';
import type { Request } from '../../request';
import type { NetworkRule } from '../../rules/network-rule';
import type { ByteBuffer } from '../../utils/byte-buffer';
import { DomainModifier } from '../../modifiers/domain-modifier';
import { fastHash } from '../../utils/string-utils';
import { BinaryMap } from '../../utils/binary-map';
import { U32LinkedList } from '../../utils/u32-linked-list';

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
     * Storage for the network filtering rules
     */
    declare private readonly ruleStorage: RuleStorage;

    /**
     * ByteBuffer to store the binary data.
     */
    declare private readonly byteBuffer: ByteBuffer;

    /**
     * Count of loaded rules
     */
    private get rulesCount(): number {
        return this.byteBuffer.getUint32(this.offset);
    }

    private set rulesCount(value: number) {
        this.byteBuffer.setUint32(this.offset, value);
    }

    /**
     * Binary map offset position in the {@link byteBuffer}
     */
    private get binaryMapPosition(): number {
        return this.byteBuffer.getUint32(this.offset + 4);
    }

    private set binaryMapPosition(value: number) {
        this.byteBuffer.setUint32(this.offset + 4, value);
    }

    /**
     * Creates a new instance
     *
     * @param storage rules storage. We store "rule indexes" in the lookup table which
     * @param buffer byte buffer to store the binary data.
     * can be used to retrieve the full rules from the storage.
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
     * addRule implements the ILookupTable interface for DomainsLookupTable.
     * @param rule
     * @param storageIdx
     */
    addRule(rule: NetworkRule, storageIdx: number): boolean {
        const permittedDomains = rule.getPermittedDomains();
        if (!permittedDomains || permittedDomains.length === 0) {
            return false;
        }

        const hasWildcardDomain = permittedDomains.some((d) => DomainModifier.isWildcardDomain(d));
        if (hasWildcardDomain) {
            return false;
        }

        permittedDomains.forEach((domain) => {
            const hash = fastHash(domain);

            // Get the position of the storage indexes for the hash
            let storageIndexesPosition = this.domainsLookupTable.get(hash);

            /**
             * If the hash is not in the lookup table, create a new {@link U32LinkedList},
             */
            if (storageIndexesPosition === undefined) {
                storageIndexesPosition = U32LinkedList.create(this.byteBuffer);
                this.domainsLookupTable.set(hash, storageIndexesPosition);
            }

            // Add the storage index to the related U32LinkedList
            U32LinkedList.add(storageIdx, this.byteBuffer, storageIndexesPosition);
        });

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
     * FIXME: description
     */
    public finalize(): void {
        this.binaryMapPosition = BinaryMap.create(this.domainsLookupTable, this.byteBuffer);
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
    ): DomainsLookupTable {
        const offset = buffer.byteOffset;
        buffer.addUint32(offset, 0);
        buffer.addUint32(offset + Uint32Array.BYTES_PER_ELEMENT, 0);
        return new DomainsLookupTable(storage, buffer, offset);
    }
}
