import { type Request } from '../request';
import { NetworkRule } from '../rules/network-rule';
import { MatchingResult } from './matching-result';
import { type RuleStorage } from '../filterlist/rule-storage';
import { ScannerType } from '../filterlist/scanner/scanner-type';
import { type ILookupTable } from './lookup-tables-1/lookup-table';
import { TrieLookupTable } from './lookup-tables-1/trie-lookup-table';
import { DomainsLookupTable } from './lookup-tables-1/domains-lookup-table';
import { HostnameLookupTable } from './lookup-tables-1/hostname-lookup-table';
import { SeqScanLookupTable } from './lookup-tables-1/seq-scan-lookup-table';
import { type ByteBuffer } from '../utils/byte-buffer';

/**
 * NetworkEngine is the engine that supports quick search over network rules.
 */
export class NetworkEngine {
    /**
     * Storage for the network filtering rules.
     */
    private ruleStorage: RuleStorage;

    /**
     * Domain lookup table. Key is the domain name hash.
     */
    private readonly domainsLookupTable: DomainsLookupTable;

    /**
     * Lookup table that relies on the rule shortcuts to speed up the search.
     */
    private readonly shortcutsLookupTable: TrieLookupTable;

    /**
     * Lookup table for rules like `||hostname^` or `||hostname/path`.
     */
    private readonly hostnameLookupTable: HostnameLookupTable;

    /**
     * Rules for which we could not find a shortcut and could not place it to the shortcuts lookup table.
     */
    private readonly seqScanLookupTable: ILookupTable;

    private static readonly DOMAINS_LOOKUP_TABLE_OFFSET_POINTER = 0;

    private static readonly SHORTCUTS_LOOKUP_TABLE_OFFSET_POINTER = 4;

    private static readonly HOSTNAME_LOOKUP_TABLE_OFFSET_POINTER = 8;

    private static readonly SEQ_SCAN_LOOKUP_TABLE_OFFSET_POINTER = 12;

    /**
     * Offset of this network engine in the buffer.
     */
    public readonly offset?: number;

    /**
     * Count of rules added to the engine.
     *
     * @returns Count of rules added to the engine.
     */
    public get rulesCount(): number {
        return this.domainsLookupTable.getRulesCount()
            + this.hostnameLookupTable.getRulesCount()
            + this.shortcutsLookupTable.getRulesCount()
            + this.seqScanLookupTable.getRulesCount();
    }

    /**
     * Builds an instance of the network engine.
     *
     * @param storage An object for a rules storage.
     * @param buffer Buffer.
     * @param offset Offset of this network engine in the buffer.
     */
    constructor(storage: RuleStorage, buffer: ByteBuffer, offset: number) {
        this.ruleStorage = storage;
        this.offset = offset;

        this.domainsLookupTable = new DomainsLookupTable(
            storage,
            buffer,
            this.offset + NetworkEngine.DOMAINS_LOOKUP_TABLE_OFFSET_POINTER,
        );

        this.hostnameLookupTable = new HostnameLookupTable(
            storage,
            buffer,
            this.offset + NetworkEngine.HOSTNAME_LOOKUP_TABLE_OFFSET_POINTER,
        );

        this.shortcutsLookupTable = new TrieLookupTable(
            storage,
            buffer,
            this.offset + NetworkEngine.SHORTCUTS_LOOKUP_TABLE_OFFSET_POINTER,
        );

        this.seqScanLookupTable = new SeqScanLookupTable(
            storage,
            buffer,
            this.offset + NetworkEngine.SEQ_SCAN_LOOKUP_TABLE_OFFSET_POINTER,
        );
    }

    /**
     * Match searches over all filtering rules loaded to the engine.
     * It returns rule if a match was found alongside the matching rule.
     *
     * @param request Request to check.
     *
     * @returns Rule matching request or null if no match was found.
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
     * It will find both allowlist and blacklist rules.
     *
     * @param request Request to check.
     *
     * @returns Array of matching rules.
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
     * Adds rule to the network engine.
     *
     * @param rule Rule to add.
     * @param storageIdx Storage index of the rule.
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

    static create(storage: RuleStorage, buffer: ByteBuffer, skipStorageScan = false) {
        const offset = buffer.byteOffset;

        const domainsLookupTablePosition = offset + NetworkEngine.DOMAINS_LOOKUP_TABLE_OFFSET_POINTER;
        const hostnameLookupTablePosition = offset + NetworkEngine.HOSTNAME_LOOKUP_TABLE_OFFSET_POINTER;
        const shortcutsLookupTablePosition = offset + NetworkEngine.SHORTCUTS_LOOKUP_TABLE_OFFSET_POINTER;
        const seqScanLookupTablePosition = offset + NetworkEngine.SEQ_SCAN_LOOKUP_TABLE_OFFSET_POINTER;

        buffer.addUint32(domainsLookupTablePosition, 0);
        buffer.addUint32(hostnameLookupTablePosition, 0);
        buffer.addUint32(shortcutsLookupTablePosition, 0);
        buffer.addUint32(seqScanLookupTablePosition, 0);

        const domainsLookupTable = DomainsLookupTable.create(storage, buffer);
        const hostnameLookupTable = HostnameLookupTable.create(storage, buffer);
        const shortcutsLookupTable = TrieLookupTable.create(storage, buffer);
        const seqScanLookupTable = SeqScanLookupTable.create(storage, buffer);

        buffer.setUint32(domainsLookupTablePosition, domainsLookupTable.offset);
        buffer.setUint32(hostnameLookupTablePosition, hostnameLookupTable.offset);
        buffer.setUint32(shortcutsLookupTablePosition, shortcutsLookupTable.offset);
        buffer.setUint32(seqScanLookupTablePosition, seqScanLookupTable.offset);

        const engine = new NetworkEngine(storage, buffer, offset);

        engine.scanRules(skipStorageScan);

        return engine;
    }

    scanRules(skipStorageScan: boolean): void {
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

    public finalize(): void {
        this.domainsLookupTable.finalize();
        this.hostnameLookupTable.finalize();
        this.shortcutsLookupTable.finalize();
    }
}
