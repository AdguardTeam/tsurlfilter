import { MatchingResult } from '../engine/matching-result';
import { type NetworkRuleParts, RuleCategory } from '../filterlist/rule-parts';
import { type RuleStorage } from '../filterlist/rule-storage-new';
import { ScannerType } from '../filterlist/scanner/scanner-type';
import { type Request } from '../request';
import { type NetworkRule } from '../rules/network-rule';
import { type IndexedStorageRule } from '../rules/rule-new';

import { CHUNK_SIZE } from './constants';
import { DomainsLookupTable } from './lookup-tables/domains-lookup-table';
import { HostnameLookupTable } from './lookup-tables/hostname-lookup-table';
import { type ILookupTable } from './lookup-tables/lookup-table';
import { SeqScanLookupTable } from './lookup-tables/seq-scan-lookup-table';
import { TrieLookupTable } from './lookup-tables/trie-lookup-table';

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
     * @param storage An object for a rules storage.
     * @param rules Array of rules to add.
     *
     * @returns An instance of the network engine.
     */
    public static createSync(storage: RuleStorage, rules: IndexedStorageRule[]): NetworkEngine {
        const engine = new NetworkEngine(storage, true);

        for (const rule of rules) {
            if (rule.rule.category !== RuleCategory.Network) {
                continue;
            }

            engine.addRule(rule.rule, rule.index);
        }

        return engine;
    }

    /**
     * Creates an instance of the network engine in async mode.
     *
     * @param storage An object for a rules storage.
     * @param rules Array of rules to add.
     *
     * @returns An instance of the network engine.
     */
    public static async createAsync(
        storage: RuleStorage,
        rules: IndexedStorageRule[],
    ): Promise<NetworkEngine> {
        const engine = new NetworkEngine(storage, true);

        let counter = 0;

        for (const rule of rules) {
            counter += 1;

            if (counter >= CHUNK_SIZE) {
                counter = 0;

                // eslint-disable-next-line no-await-in-loop, no-promise-executor-return
                await new Promise((resolve) => setTimeout(resolve, 1));
            }

            if (rule.rule.category !== RuleCategory.Network) {
                continue;
            }

            engine.addRule(rule.rule, rule.index);
        }

        return engine;
    }

    /**
     * Builds an instance of the network engine.
     *
     * @param storage An object for a rules storage.
     * @param skipStorageScan Create an instance without storage scanning.
     */
    private constructor(storage: RuleStorage, skipStorageScan = false) {
        this.ruleStorage = storage;

        this.domainsLookupTable = new DomainsLookupTable(storage);
        this.hostnameLookupTable = new HostnameLookupTable(storage);
        this.shortcutsLookupTable = new TrieLookupTable(storage);
        this.seqScanLookupTable = new SeqScanLookupTable(storage);

        if (skipStorageScan) {
            return;
        }

        const scanner = this.ruleStorage.createRuleStorageScanner(ScannerType.NetworkRules);

        while (scanner.scan()) {
            const indexedRule = scanner.getRule();

            if (!indexedRule) {
                continue;
            }

            const { rule: ruleParts } = indexedRule;

            // FIXME (David): Probably we have a possible optimization step here.
            // When initial scan is enabled, the core engine passes it to its network and cosmetic engines,
            // and they creates their own scanners.
            // However, `list.newScanner` using the list own `ignoreCosmetic` etc props,
            // so we need to filter out cosmetic rules here now.
            if (ruleParts.category !== RuleCategory.Network) {
                continue;
            }

            this.addRule(ruleParts, indexedRule.index);
        }
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
     * @param rule Parts of rule to add.
     * @param storageIdx Storage index of the rule.
     */
    private addRule(rule: NetworkRuleParts, storageIdx: number): void {
        if (this.hostnameLookupTable.addRule(rule, storageIdx)) {
            return;
        }

        if (this.shortcutsLookupTable.addRule(rule, storageIdx)) {
            return;
        }

        if (this.domainsLookupTable.addRule(rule, storageIdx)) {
            return;
        }

        this.seqScanLookupTable.addRule(rule, storageIdx);
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
