import { ILookupTable } from './lookup-table';
import { RuleStorage } from '../../filterlist/rule-storage';
import { Request } from '../../request';
import { DomainModifier } from '../../modifiers/domain-modifier';
import { fastHash } from '../../utils/string-utils';
import { NetworkRule } from '../../rules/network-rule';

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
    private readonly domainsLookupTable = new Map<number, number[]>();

    /**
     * Storage for the network filtering rules
     */
    private readonly ruleStorage: RuleStorage;

    /**
     * Creates a new instance
     *
     * @param storage rules storage. We store "rule indexes" in the lookup table which
     * can be used to retrieve the full rules from the storage.
     */
    constructor(storage: RuleStorage) {
        this.ruleStorage = storage;
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

        if (permittedDomains.some(DomainModifier.isWildcardOrRegexDomain)) {
            return false;
        }

        permittedDomains.forEach((domain) => {
            const hash = fastHash(domain);

            // Add the rule to the lookup table
            let rulesIndexes = this.domainsLookupTable.get(hash);
            if (!rulesIndexes) {
                rulesIndexes = [];
            }
            rulesIndexes.push(storageIdx);
            this.domainsLookupTable.set(hash, rulesIndexes);
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
            const rulesIndexes = this.domainsLookupTable.get(hash);
            if (rulesIndexes) {
                for (let j = 0; j < rulesIndexes.length; j += 1) {
                    const rule = this.ruleStorage.retrieveNetworkRule(rulesIndexes[j]);
                    if (rule && rule.match(request)) {
                        result.push(rule);
                    }
                }
            }
        }

        return result;
    }
}
