import { type NetworkRuleParts } from '../../filterlist/rule-parts';
import { type RuleStorage } from '../../filterlist/rule-storage';
import { type Request } from '../../request';
import { type NetworkRule } from '../../rules/network-rule';
import { SimpleRegex } from '../../rules/simple-regex';
import { fastHash } from '../../utils/string-utils';

import { type ILookupTable } from './lookup-table';

/**
 * Hostname lookup table.
 * For specific kind of rules like '||hostname^' and '||hostname/path' more simple algorithm with hashes is faster.
 */
// TODO: This lookup table has a lot of common code with DomainsLookupTable,
// probably we can extract common code into a base class
export class HostnameLookupTable implements ILookupTable {
    /**
     * Count of rules added to this lookup table.
     */
    private rulesCount = 0;

    /**
     * Domain lookup table. Key is the domain name hash.
     * Value is an array of rule indexes in the storage.
     */
    private readonly hostnameLookupTable = new Map<number, number[]>();

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
        const { patternStart, patternEnd } = ruleParts;
        const pattern = ruleParts.text.slice(patternStart, patternEnd);

        if (!HostnameLookupTable.accepts(pattern)) {
            return false;
        }

        const hash = fastHash(HostnameLookupTable.extractHostname(pattern));
        let rulesIndexes = this.hostnameLookupTable.get(hash);
        if (!rulesIndexes) {
            rulesIndexes = [];
            this.hostnameLookupTable.set(hash, rulesIndexes);
        }
        rulesIndexes.push(storageIdx);
        this.rulesCount += 1;
        return true;
    }

    /** @inheritdoc */
    public getRulesCount(): number {
        return this.rulesCount;
    }

    /** @inheritdoc */
    public matchAll(request: Request): NetworkRule[] {
        const result: NetworkRule[] = [];
        const domains = request.subdomains;
        for (let i = 0; i < domains.length; i += 1) {
            const hash = fastHash(domains[i]);
            const rulesIndexes = this.hostnameLookupTable.get(hash);
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

    /**
     * Checks whether the table accepts the pattern. Single source of the
     * decision: `addRule()` and the public rule inspection both use it.
     *
     * @param pattern Network rule pattern.
     *
     * @returns True when the engine keeps the rule in this table.
     */
    public static accepts(pattern: string): boolean {
        return HostnameLookupTable.isValidHostname(HostnameLookupTable.extractHostname(pattern));
    }

    /**
     * Extracts the hostname the rule is keyed by.
     *
     * @param pattern Network rule pattern.
     *
     * @returns Hostname, or an empty string when the pattern is not keyed by
     * one.
     */
    private static extractHostname(pattern: string): string {
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

        return hostname;
    }

    /**
     * Checks if this hostname string is valid.
     *
     * @param hostname Hostname to check.
     *
     * @returns True if the hostname is valid.
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
}
