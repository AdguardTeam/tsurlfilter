import { Request } from '../request';
import { NetworkRule } from '../network-rule';
import { MatchingResult } from './matching-result';
import { fastHash, fastHashBetween } from '../utils';

/**
 * NetworkEngine is the engine that supports quick search over network rules
 */
export class NetworkEngine {
    /**
     * Rule shortcut max length
     */
    private static SHORTCUT_LENGTH: number = 5;

    /**
     * Limit the URL length with 4KB.
     * It appears that there can be URLs longer than a megabyte and it makes no sense to go through the whole URL
     * @type {number}
     */
    private static MAX_URL_LENGTH: number = 4 * 1024;

    /**
     * Count of rules added to the engine
     */
    private rulesCount: number;

    /**
     * Storage for the network filtering rules
     */
    private ruleStorage: any;

    /**
     * Domain lookup table. Key is the domain name hash.
     */
    private domainsLookupTable: any;

    /**
     * Shortcuts lookup table. Key is the shortcut hash.
     */
    private shortcutsLookupTable: any;
    /**
     * Shortcuts histogram helps us choose the best shortcut for the shortcuts lookup table.
     */
    private shortcutsHistogram: any;

    /**
     * Rules for which we could not find a shortcut and could not place it to the shortcuts lookup table.
     */
    private otherRules: NetworkRule[];

    /**
     * Constructor
     *
     * @param rules
     */
    constructor(rules: string[]) {
        this.rulesCount = 0;
        this.domainsLookupTable = {};
        this.shortcutsLookupTable = {};
        this.shortcutsHistogram = {};
        this.otherRules = [];

        // TODO: Implement RulesStorage
        this.ruleStorage = {
            retrieveNetworkRule(index: number) {
                return rules[index];
            },
        };

        rules.forEach(r => this.addRule(new NetworkRule(r, 0), rules.indexOf(r)));
    }

    /**
     * Match searches over all filtering rules loaded to the engine
     * It returns true if a match was found alongside the matching rule
     *
     * @param request
     */
    match(request: Request): NetworkRule | null {
        const networkRules = this.matchAll(request);

        if (networkRules.length === 0) {
            return null;
        }

        const result = new MatchingResult(networkRules, null);
        return result.getBasicResult();
    }

    /**
     * Finds all rules matching the specified request regardless of the rule types
     * It will find both whitelist and blacklist rules
     *
     * @param request
     */
    matchAll(request: Request): NetworkRule[] {
        // First check by shortcuts
        const result = this.matchShortcutsLookupTable(request);
        result.push(...this.matchDomainsLookupTable(request));

        // Now check other rules
        this.otherRules.forEach(r => {
            if (r.match(request)) {
                result.push(r);
            }
        });

        return result;
    }

    /**
     * Finds all matching rules from the shortcuts lookup table
     *
     * @param request
     */
    private matchShortcutsLookupTable(request: Request): NetworkRule[] {
        const result: NetworkRule[] = [];

        let urlLen = request.urlLowercase.length;
        if (urlLen > NetworkEngine.MAX_URL_LENGTH) {
            urlLen = NetworkEngine.MAX_URL_LENGTH;
        }

        for (let i = 0; i <= urlLen - NetworkEngine.SHORTCUT_LENGTH; i += 1) {
            const hash = fastHashBetween(request.urlLowercase, i, i + NetworkEngine.SHORTCUT_LENGTH);
            const rulesIndexes: number[] = this.shortcutsLookupTable[hash];
            console.log(rulesIndexes);

            if (rulesIndexes) {
                rulesIndexes.forEach(ruleIdx => {
                    const rule: NetworkRule = this.ruleStorage.retrieveNetworkRule(ruleIdx);
                    if (rule && rule.match(request)) {
                        result.push(rule);
                    }
                });
            }
        }

        return result;
    }

    /**
     * Finds all matching rules from the domains lookup table
     *
     * @param request
     */
    private matchDomainsLookupTable(request: Request): NetworkRule[] {
        const result: NetworkRule[] = [];

        if (!request.sourceHostname) {
            return result;
        }

        const domains = NetworkEngine.getSubdomains(request.sourceHostname);
        domains.forEach(domain => {
            const hash = fastHash(domain);
            const rulesIndexes: number[] = this.domainsLookupTable[hash];
            if (rulesIndexes) {
                rulesIndexes.forEach(ruleIdx => {
                    const rule: NetworkRule = this.ruleStorage.retrieveNetworkRule(ruleIdx);
                    if (rule && rule.match(request)) {
                        result.push(rule);
                    }
                });
            }
        });

        return result;
    }

    /**
     * Adds rule to the network engine
     *
     * @param rule
     * @param storageIdx
     */
    private addRule(rule: NetworkRule, storageIdx: number) {
        if (!this.addRuleToShortcutsTable(rule, storageIdx)) {
            if (!this.addRuleToDomainsTable(rule, storageIdx)) {
                if (!this.otherRules.includes(rule)) {
                    this.otherRules.push(rule);
                }
            }
        }

        this.rulesCount += 1;
    }

    /**
     * Tries to add the rule to the domains lookup table.
     * returns true if it was added
     *
     * @param rule
     * @param storageIdx
     */
    private addRuleToShortcutsTable(rule: NetworkRule, storageIdx: number) {
        const shortcuts = this.getRuleShortcuts(rule);
        if (!shortcuts || shortcuts.length === 0) {
            return false;
        }

        // Find the applicable shortcut (the least used)
        let shortcutHash: number = -1;
        // Max int32
        let minCount = 2147483647;

        shortcuts.forEach(shortcutToCheck => {
            const hash = fastHash(shortcutToCheck);
            const count = this.shortcutsHistogram[hash];
            if (count < minCount) {
                minCount = count;
                shortcutHash = hash;
            }
        });

        // Increment the histogram
        this.shortcutsHistogram[shortcutHash] = minCount + 1;

        // Add the rule to the lookup table
        let rulesIndexes = this.shortcutsLookupTable[shortcutHash];
        if (!rulesIndexes) {
            rulesIndexes = [];
        }
        rulesIndexes.push(storageIdx);

        this.shortcutsLookupTable[shortcutHash] = rulesIndexes;

        return true;
    }

    /**
     * Returns a list of shortcuts that can be used for the lookup table
     *
     * @param rule
     * @return {any}
     */
    private getRuleShortcuts(rule: NetworkRule): string[] | null {
        const shortcut = rule.getShortcut();
        if (shortcut.length < NetworkEngine.SHORTCUT_LENGTH) {
            return null;
        }

        if (NetworkEngine.isAnyURLShortcut(rule)) {
            return null;
        }

        const result: string[] = [];
        for (let i = 0; i < shortcut.length - NetworkEngine.SHORTCUT_LENGTH; i += 1) {
            const s = shortcut.substring(i, i + NetworkEngine.SHORTCUT_LENGTH);
            result.push(s);
        }

        return result;
    }

    /**
     * Checks if the rule potentially matches too many URLs.
     * We'd better use another type of lookup table for this kind of rules.
     *
     * @param rule
     */
    private static isAnyURLShortcut(rule: NetworkRule): boolean {
        const shortcut = rule.getShortcut();

        // The numbers are basically ("PROTO://".length + 1)
        if (shortcut.length < 6 && shortcut.indexOf('ws:') === 0) {
            return true;
        }

        if (shortcut.length < 7 && shortcut.indexOf('|ws') === 0) {
            return true;
        }

        if (shortcut.length < 9 && shortcut.indexOf('http') === 0) {
            return true;
        }

        if (shortcut.length < 10 && shortcut.indexOf('|http') === 0) {
            return true;
        }

        return false;
    }

    /**
     * Tries to add the rule to the shortcuts table.
     * returns true if it was added or false if the shortcut is too short
     *
     * @param rule
     * @param storageIdx
     */
    private addRuleToDomainsTable(rule: NetworkRule, storageIdx: number) {
        const permittedDomains = rule.getPermittedDomains();
        if (!permittedDomains || permittedDomains.length === 0) {
            return false;
        }

        permittedDomains.forEach(domain => {
            const hash = fastHash(domain);

            // Add the rule to the lookup table
            let rulesIndexes = this.domainsLookupTable[hash];
            if (!rulesIndexes) {
                rulesIndexes = [];
            }
            rulesIndexes.push(storageIdx);
            this.domainsLookupTable[hash] = rulesIndexes;
        });

        return true;
    }

    /**
     * Splits the specified hostname and returns all subdomains (including the hostname itself)
     *
     * @param hostname
     * @return {any}
     */
    private static getSubdomains(hostname: string): string[] {
        const parts = hostname.split('.');
        const subdomains = [];
        let domain = '';

        for (let i = parts.length - 1; i >= 0; i -= 1) {
            if (domain === '') {
                domain = parts[i];
            } else {
                domain = `${parts[i]}.${domain}`;
            }

            subdomains.push(domain);
        }

        return subdomains;
    }
}
