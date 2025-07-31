import { type RuleStorage } from '../../filterlist/rule-storage';
import { DomainModifier } from '../../modifiers/domain-modifier';
import { type Request } from '../../request';
import { type NetworkRule } from '../../rules/network-rule';
import { fastHash } from '../../utils/string-utils';

import { type ILookupTable } from './lookup-table';

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
     * Storage for the network filtering rules.
     */
    private readonly ruleStorage: RuleStorage;

    /**
     * Creates a new instance.
     *
     * @param storage Rules storage. We store "rule indexes" in the lookup table which
     * can be used to retrieve the full rules from the storage.
     */
    constructor(storage: RuleStorage) {
        this.ruleStorage = storage;
    }

    /**
     * Implements the ILookupTable interface for DomainsLookupTable.
     *
     * @param rule Rule to add.
     * @param storageIdx Index of the rule in the storage.
     *
     * @returns True if the rule was added.
     */
    public addRule(rule: NetworkRule, storageIdx: number): boolean {
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
     *
     * @returns The count of rules added to this lookup table.
     */
    public getRulesCount(): number {
        return this.rulesCount;
    }

    /**
     * Implements the ILookupTable interface method.
     *
     * @param request Request to check.
     *
     * @returns Array of matching network rules.
     */
    public matchAll(request: Request): NetworkRule[] {
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
