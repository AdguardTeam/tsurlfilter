import { ILookupTable } from './lookup-table';
import { RuleStorage } from '../../filterlist/rule-storage';
import { Request } from '../../request';
import { DomainModifier } from '../../modifiers/domain-modifier';
import { fastHash } from '../../utils/string-utils';
import { NetworkRule } from '../../rules/network-rule';
import { BinaryMap } from '../../utils/binary-map';
import { ByteBuffer } from '../../utils/byte-buffer';
import { U32LinkedList } from '../../utils/u32-linked-list';
import { StorageIndex } from '../../utils/storage-index';

/**
 * Domain lookup table. Key is the domain name hash.
 */
export class DomainsLookupTable implements ILookupTable {
    /**
     * Count of rules added to this lookup table.
     */
    private rulesCount = 0;

    /**
     * Domain lookup table. Key is the domain name hash.
     */
    private domainsLookupTable = new Map<number, number>();

    /**
     * Storage for the network filtering rules
     */
    private readonly ruleStorage: RuleStorage;

    private readonly byteBuffer: ByteBuffer;

    private readonly storageIndexesListPosition: number = 0;

    declare private binaryMapPosition: number;

    /**
     * Creates a new instance
     *
     * @param storage rules storage. We store "rule indexes" in the lookup table which
     * can be used to retrieve the full rules from the storage.
     */
    constructor(storage: RuleStorage, buffer: ByteBuffer) {
        this.ruleStorage = storage;
        this.byteBuffer = buffer;
        this.storageIndexesListPosition = U32LinkedList.create(buffer);
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

            // Add the rule to the lookup table
            const storageIndexPosition = StorageIndex.add(this.byteBuffer, storageIdx);
            let storageIndexesPosition = this.domainsLookupTable.get(hash);

            if (storageIndexesPosition === undefined) {
                storageIndexesPosition = U32LinkedList.create(this.byteBuffer);
                U32LinkedList.add(storageIndexesPosition, this.byteBuffer, this.storageIndexesListPosition);
                this.domainsLookupTable.set(hash, storageIndexesPosition);
            }

            U32LinkedList.add(storageIndexPosition, this.byteBuffer, storageIndexesPosition);
        });

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

        if (!request.sourceHostname) {
            return result;
        }

        const domains = request.subdomains;
        if (request.hostname !== request.sourceHostname) {
            domains.push(...request.sourceSubdomains);
        }

        for (let i = 0; i < domains.length; i += 1) {
            const hash = fastHash(domains[i]);
            const storageIndexesPosition = BinaryMap.get(hash, this.byteBuffer, this.binaryMapPosition);
            if (storageIndexesPosition !== undefined) {
                U32LinkedList.forEach((storageIndexPosition) => {
                    const storageIndex = StorageIndex.get(this.byteBuffer, storageIndexPosition);

                    const rule = this.ruleStorage.retrieveNetworkRule(storageIndex);

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
}
