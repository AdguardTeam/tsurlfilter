import { Request } from '../request';
import { NetworkRule } from '../rules/network-rule';
import { MatchingResult } from './matching-result';
import { RuleStorage } from '../filterlist/rule-storage';
import { ScannerType } from '../filterlist/scanner/scanner-type';
import { ILookupTable } from './lookup-tables/lookup-table';
import { TrieLookupTable } from './lookup-tables/trie-lookup-table';
import { DomainsLookupTable } from './lookup-tables/domains-lookup-table';
import { HostnameLookupTable } from './lookup-tables/hostname-lookup-table';
import { SeqScanLookupTable } from './lookup-tables/seq-scan-lookup-table';
import type { ByteBuffer } from '../utils/byte-buffer';

/**
 * NetworkEngine is the engine that supports quick search over network rules
 */
export class NetworkEngine {
    /**
     * Count of rules added to the engine
     */
    public get rulesCount(): number {
        return this.domainsLookupTable.getRulesCount()
        + this.hostnameLookupTable.getRulesCount()
        + this.shortcutsLookupTable.getRulesCount()
        + this.seqScanLookupTable.getRulesCount();
    }

    /**
     * Storage for the network filtering rules
     */
    private ruleStorage: RuleStorage;

    /**
     * Domain lookup table. Key is the domain name hash.
     */
    declare private readonly domainsLookupTable: DomainsLookupTable;

    /**
     * Lookup table that relies on the rule shortcuts to speed up the search.
     */
    declare private readonly shortcutsLookupTable: TrieLookupTable;

    /**
     * Lookup table for rules like '||hostname^' or '||hostname/path'
     */
    declare private readonly hostnameLookupTable: HostnameLookupTable;

    /**
     * Rules for which we could not find a shortcut and could not place it to the shortcuts lookup table.
     */
    declare private readonly seqScanLookupTable: ILookupTable;

    declare private readonly byteBuffer: ByteBuffer;

    /**
     * Builds an instance of the network engine
     *
     * @param storage an object for a rules storage.
     * @param skipStorageScan create an instance without storage scanning.
     */
    constructor(storage: RuleStorage, buffer: ByteBuffer, skipStorageScan = false) {
        this.ruleStorage = storage;

        this.byteBuffer = buffer;
        this.domainsLookupTable = DomainsLookupTable.create(storage, this.byteBuffer);
        this.hostnameLookupTable = HostnameLookupTable.create(storage, this.byteBuffer);
        this.shortcutsLookupTable = TrieLookupTable.create(storage, this.byteBuffer);
        this.seqScanLookupTable = SeqScanLookupTable.create(storage, this.byteBuffer);

        if (skipStorageScan) {
            return;
        }

        const scanner = this.ruleStorage.createRuleStorageScanner(ScannerType.NetworkRules);

        while (scanner.scan()) {
            const indexedRule = scanner.getRule();
            if (indexedRule
                && indexedRule.rule instanceof NetworkRule) {
                this.addRule(indexedRule.rule, indexedRule.index);
            }
        }
    }

    /**
     * Match searches over all filtering rules loaded to the engine
     * It returns rule if a match was found alongside the matching rule
     *
     * @param request to check
     * @return rule matching request or null
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
     * It will find both allowlist and blacklist rules
     *
     * @param request to check
     * @return array of matching rules
     */
    matchAll(request: Request): NetworkRule[] {
        // First check by shortcuts
        const result = this.hostnameLookupTable.matchAll(request);
        result.push(...(this.shortcutsLookupTable.matchAll(request)));
        result.push(...(this.domainsLookupTable.matchAll(request)));
        result.push(...(this.seqScanLookupTable.matchAll(request)));

        return result;
    }

    /**
     * Adds rule to the network engine
     *
     * @param rule
     * @param storageIdx
     */
    public addRule(rule: NetworkRule, storageIdx: number): void {
        if (!this.hostnameLookupTable.addRule(rule, storageIdx)) {
            if (!this.shortcutsLookupTable.addRule(rule, storageIdx)) {
                if (!this.domainsLookupTable.addRule(rule, storageIdx)) {
                    this.seqScanLookupTable.addRule(rule, storageIdx);
                }
            }
        }
    }

    public finalize(): void {
        this.domainsLookupTable.finalize();
        this.hostnameLookupTable.finalize();
        this.shortcutsLookupTable.finalize();
    }
}
