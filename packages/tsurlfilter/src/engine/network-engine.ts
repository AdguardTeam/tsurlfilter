import { type NetworkRuleParts } from '../filterlist/rule-parts';
import { type RuleStorage } from '../filterlist/rule-storage';
import { type Request } from '../request';
import { type NetworkRule, type WrittenRuleTextResolver } from '../rules/network-rule';
import { type IndexedStorageNetworkRuleParts } from '../rules/rule';

import { CHUNK_SIZE } from './constants';
import { DomainsLookupTable } from './lookup-tables/domains-lookup-table';
import { HostnameLookupTable } from './lookup-tables/hostname-lookup-table';
import { type ILookupTable } from './lookup-tables/lookup-table';
import { RULE_TABLE_ORDER, RuleTable } from './lookup-tables/rule-table';
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
     * Resolves the text of a rule as written in the filter list.
     */
    private readonly resolveWrittenText: WrittenRuleTextResolver;

    /**
     * Lookup tables by the kind of rule they hold.
     *
     * The engine walks them in {@link RULE_TABLE_ORDER} — the same order
     * `getRuleTable()` reports — so a rule is added to, matched from and
     * reported in one and the same table.
     */
    private readonly lookupTables: Record<RuleTable, ILookupTable>;

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

                // Pause rule loading and let the browser handle pending UI
                // updates (repaints, user input, etc.) before continuing.
                // We use setTimeout (macrotask) instead of Promise.resolve()
                // (microtask) because microtasks don't give the browser a
                // chance to refresh the screen or respond to user actions.
                // eslint-disable-next-line no-await-in-loop
                await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
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
        this.resolveWrittenText = storage.createWrittenTextResolver();

        this.lookupTables = {
            [RuleTable.Hostname]: new HostnameLookupTable(storage),
            [RuleTable.Shortcut]: new TrieLookupTable(storage),
            [RuleTable.Domains]: new DomainsLookupTable(storage),
            [RuleTable.Seqscan]: new SeqScanLookupTable(storage),
        };
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

        const result = new MatchingResult(networkRules, null, this.resolveWrittenText);
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
        // The tables are walked in `RULE_TABLE_ORDER`, which is also the order
        // `NetworkEngine.addRule()` stores into and `getRuleTable()` reports.
        const result: NetworkRule[] = [];

        for (const table of RULE_TABLE_ORDER) {
            result.push(...this.lookupTables[table].matchAll(request));
        }

        return result;
    }

    /**
     * Adds rule to the network engine.
     *
     * @param ruleParts Parts of rule to add.
     * @param storageIdx Storage index of the rule.
     */
    private addRule(ruleParts: NetworkRuleParts, storageIdx: number): void {
        for (const table of RULE_TABLE_ORDER) {
            if (this.lookupTables[table].addRule(ruleParts, storageIdx)) {
                return;
            }
        }
    }

    /**
     * Returns the total number of rules in the engine.
     *
     * @returns The total number of rules.
     */
    public get rulesCount(): number {
        let count = 0;

        for (const table of RULE_TABLE_ORDER) {
            count += this.lookupTables[table].getRulesCount();
        }

        return count;
    }
}
