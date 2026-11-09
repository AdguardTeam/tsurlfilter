import { type NetworkRuleParts } from '../../filterlist/rule-parts';
import { type RuleStorage } from '../../filterlist/rule-storage';
import { DomainModifier } from '../../modifiers/domain-modifier';
import { type Request } from '../../request';
import { type NetworkRule } from '../../rules/network-rule';
import { fastHash } from '../../utils/string-utils';

import { type ILookupTable } from './lookup-table';

/**
 * Splits the raw `$domain` value into domains the way the rule parser does:
 * only an unescaped `|` separates values, so a regex domain that contains one
 * (`/a\|b/`) stays a single value.
 *
 * The parser resolves the escape, so the engine and `getRuleTable()` see the
 * same list: a raw split would turn the regex into pieces that no longer look
 * like a regex, and the rule would be filed under domains that never match.
 *
 * @param text Raw `$domain` value.
 *
 * @returns Domain values as written, restricted ones keeping the `~` prefix.
 */
const splitDomains = (text: string): string[] => {
    const domains: string[] = [];
    let current = '';

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (char === '|') {
            // Count the backslashes before the separator: an odd number means
            // the pipe is escaped and belongs to the value.
            let backslashes = 0;
            while (current[current.length - 1 - backslashes] === '\\') {
                backslashes += 1;
            }
            if (backslashes % 2 === 0) {
                domains.push(current);
                current = '';
                continue;
            }
        }
        current += char;
    }

    domains.push(current);

    return domains;
};

/**
 * Domain lookup table.
 */
// TODO: This lookup table has a lot of common code with HostnameLookupTable,
// probably we can extract common code into a base class
export class DomainsLookupTable implements ILookupTable {
    /**
     * Count of rules added to this lookup table.
     */
    private rulesCount = 0;

    /**
     * Domain lookup table. Key is the domain name hash.
     * Value is an array of rule indexes in the storage.
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

    /** @inheritdoc */
    public addRule(ruleParts: NetworkRuleParts, storageIdx: number): boolean {
        if (ruleParts.domainsStart === undefined || ruleParts.domainsEnd === undefined) {
            return false;
        }

        const domains = splitDomains(ruleParts.text.slice(ruleParts.domainsStart, ruleParts.domainsEnd));

        if (!DomainsLookupTable.accepts(domains)) {
            return false;
        }

        const filteredDomains = domains.filter((domain) => !domain.startsWith('~'));

        filteredDomains.forEach((domain) => {
            const hash = fastHash(domain);
            let rulesIndexes = this.domainsLookupTable.get(hash);
            if (!rulesIndexes) {
                rulesIndexes = [];
                this.domainsLookupTable.set(hash, rulesIndexes);
            }
            rulesIndexes.push(storageIdx);
        });

        this.rulesCount += 1;
        return true;
    }

    /**
     * Checks whether the table accepts the rule's `$domain` list. Single
     * source of the decision: `addRule()` and the public rule inspection both
     * use it.
     *
     * @param domains Domains as written in the rule: restricted ones keep the
     * `~` prefix.
     *
     * @returns True when the engine keeps the rule in this table.
     */
    public static accepts(domains: readonly string[]): boolean {
        let hasPermitted = false;

        for (const domain of domains) {
            if (DomainModifier.isWildcardOrRegexDomain(domain)) {
                return false;
            }

            if (!domain.startsWith('~')) {
                hasPermitted = true;
            }
        }

        return hasPermitted;
    }

    /** @inheritdoc */
    public getRulesCount(): number {
        return this.rulesCount;
    }

    /** @inheritdoc */
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
            if (!rulesIndexes) {
                continue;
            }
            for (let j = 0; j < rulesIndexes.length; j += 1) {
                let rule: NetworkRule | null = null;
                let shouldRemove: boolean = false;

                try {
                    rule = this.ruleStorage.retrieveNetworkRule(rulesIndexes[j]);

                    if (!rule) {
                        shouldRemove = true;
                    }
                } catch (e) {
                    shouldRemove = true;
                }

                if (shouldRemove) {
                    // Fast tokenizing possibly allowed invalid rules
                    // Remove the rule index from the lookup table but keep the same array reference
                    rulesIndexes.splice(j, 1);
                    j -= 1;
                    continue;
                }

                if (rule && rule.match(request)) {
                    result.push(rule);
                }
            }
        }

        return result;
    }
}
