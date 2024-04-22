import { ILookupTable } from './lookup-table';
import { RuleStorage } from '../../filterlist/rule-storage';
import { Request } from '../../request';
import { DomainModifier } from '../../modifiers/domain-modifier';
import { fastHash } from '../../utils/string-utils';
import { NetworkRule } from '../../rules/network-rule';
import { BinaryMap } from '../../utils/binary-map';
import { ByteBuffer } from '../../utils/byte-buffer';
import { U32LinkedList } from '../../utils/u32-linked-list';

/**
 * Domain lookup table. Key is the domain name hash.
 */
export class DomainsLookupTable implements ILookupTable {
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
     * @param buffer byte buffer to store the binary data.
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

        const domains = request.subdomains;
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

    finalize(): void {
        this.binaryMapPosition = BinaryMap.create(this.domainsLookupTable, this.byteBuffer);
    }

    private pushRulesCountToBuffer() {
        this.ruleCountPosition = this.byteBuffer.byteOffset;
        this.byteBuffer.addUint32(this.ruleCountPosition, 0);
    }

    /**
     * R
     * @private
     */
    public serialize(): number {
        const position = this.byteBuffer.byteOffset;
        this.byteBuffer.addUint32(position, this.ruleCountPosition);
        this.byteBuffer.addUint32(position + 4, this.binaryMapPosition);
        return position;
    }

    /**
     * FIXME description
     * @param ruleStorage
     * @param buffer
     * @param position
     */
    public static deserialize(
        ruleStorage: RuleStorage,
        buffer: ByteBuffer,
        position: number,
    ): DomainsLookupTable {
        const domainsLookupTable = new DomainsLookupTable(ruleStorage, buffer);
        const rulesCountPosition = buffer.getUint32(position);
        const binaryMapPosition = buffer.getUint32(position + 4);
        domainsLookupTable.ruleCountPosition = rulesCountPosition;
        domainsLookupTable.binaryMapPosition = binaryMapPosition;
        return domainsLookupTable;
    }
}
