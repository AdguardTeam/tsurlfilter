import { type NetworkRuleParts } from '../filterlist/rule-parts';
import { type RuleStorage } from '../filterlist/rule-storage';
import { type Request } from '../request';
import { type NetworkRule } from '../rules/network-rule';
import { type IndexedStorageNetworkRuleParts } from '../rules/rule';

import { CHUNK_SIZE } from './constants';
import { DomainsLookupTable } from './lookup-tables/domains-lookup-table';
import { HostnameLookupTable } from './lookup-tables/hostname-lookup-table';
import { type ILookupTable } from './lookup-tables/lookup-table';
import { SeqScanLookupTable } from './lookup-tables/seq-scan-lookup-table';
import { TrieLookupTable } from './lookup-tables/trie-lookup-table';
import { MatchingResult } from './matching-result';

/**
 * NetworkEngine is the engine that supports quick search over network rules.
 */
export class NetworkEngine {
    /**
     * Storage for the network filtering rules.
     */
    private ruleStorage: RuleStorage;

    /**
     * Domain lookup table.
     */
    private readonly domainsLookupTable: ILookupTable;

    /**
     * Lookup table that relies on the rule shortcuts to speed up the search.
     */
    private readonly shortcutsLookupTable: ILookupTable;

    /**
     * Lookup table for rules like `||hostname^` or `||hostname/path`.
     */
    private readonly hostnameLookupTable: ILookupTable;

    /**
     * Rules for which we could not find a shortcut and could not place it to the shortcuts lookup table.
     */
    private readonly seqScanLookupTable: ILookupTable;

    /**
     * Creates an instance of the network engine in sync mode.
     *
     * @param indexedRulesParts Array of indexed storage network rules.
     * @param storage An object for a rules storage.
     *
     * @returns An instance of the network engine.
     */
    public static createSync(indexedRulesParts: IndexedStorageNetworkRuleParts[], storage: RuleStorage): NetworkEngine {
        const engine = new NetworkEngine(storage);

        for (const indexedRuleParts of indexedRulesParts) {
            engine.addRule(indexedRuleParts.ruleParts, indexedRuleParts.index);
        }

        return engine;
    }

    /**
     * Creates an instance of the network engine in async mode.
     *
     * @param indexedRulesParts Array of indexed storage network rules.
     * @param storage An object for a rules storage.
     *
     * @returns An instance of the network engine.
     */
    public static async createAsync(
        indexedRulesParts: IndexedStorageNetworkRuleParts[],
        storage: RuleStorage,
    ): Promise<NetworkEngine> {
        const engine = new NetworkEngine(storage);

        let counter = 0;

        for (const indexedRuleParts of indexedRulesParts) {
            counter += 1;

            if (counter >= CHUNK_SIZE) {
                counter = 0;

                // eslint-disable-next-line no-await-in-loop, no-promise-executor-return
                await Promise.resolve();
            }

            engine.addRule(indexedRuleParts.ruleParts, indexedRuleParts.index);
        }

        return engine;
    }

    /**
     * Builds an instance of the network engine.
     *
     * @param storage An object for a rules storage.
     */
    private constructor(storage: RuleStorage) {
        this.ruleStorage = storage;

        this.domainsLookupTable = new DomainsLookupTable(storage);
        this.hostnameLookupTable = new HostnameLookupTable(storage);
        this.shortcutsLookupTable = new TrieLookupTable(storage);
        this.seqScanLookupTable = new SeqScanLookupTable(storage);
    }

    /**
     * Match searches over all filtering rules loaded to the engine.
     * It returns rule if a match was found alongside the matching rule.
     *
     * @param request Request to check.
     *
     * @returns Rule matching request or null if no match was found.
     */
    public match(request: Request): NetworkRule | null {
        const networkRules = this.matchAll(request);

        if (networkRules.length === 0) {
            return null;
        }

        const result = new MatchingResult(networkRules, null);
        return result.getBasicResult();
    }

    /**
     * Finds all rules matching the specified request regardless of the rule types
     * It will find both allowlist and blacklist rules.
     *
     * @param request Request to check.
     *
     * @returns Array of matching rules.
     */
    public matchAll(request: Request): NetworkRule[] {
        // First check by shortcuts
        const result = this.hostnameLookupTable.matchAll(request);
        result.push(...(this.shortcutsLookupTable.matchAll(request)));
        result.push(...(this.domainsLookupTable.matchAll(request)));
        result.push(...(this.seqScanLookupTable.matchAll(request)));

        return result;
    }

    /**
     * Adds rule to the network engine.
     *
     * @param ruleParts Parts of rule to add.
     * @param storageIdx Storage index of the rule.
     */
    private addRule(ruleParts: NetworkRuleParts, storageIdx: number): void {
        if (this.hostnameLookupTable.addRule(ruleParts, storageIdx)) {
            return;
        }

        if (this.shortcutsLookupTable.addRule(ruleParts, storageIdx)) {
            return;
        }

        if (this.domainsLookupTable.addRule(ruleParts, storageIdx)) {
            return;
        }

        this.seqScanLookupTable.addRule(ruleParts, storageIdx);
    }

    /**
     * Returns the total number of rules in the engine.
     *
     * @returns The total number of rules.
     */
    public get rulesCount(): number {
        return this.domainsLookupTable.getRulesCount()
            + this.hostnameLookupTable.getRulesCount()
            + this.shortcutsLookupTable.getRulesCount()
            + this.seqScanLookupTable.getRulesCount();
    }
}
