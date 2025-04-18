import { type Request } from '../request';
import { type NetworkRule } from '../rules/network-rule';
import { MatchingResult } from './matching-result';
import { type RuleStorage } from '../filterlist/rule-storage';
import { type ILookupTable } from './lookup-tables/lookup-table';
import { TrieLookupTable } from './lookup-tables/trie-lookup-table';
import { DomainsLookupTable } from './lookup-tables/domains-lookup-table';
import { HostnameLookupTable } from './lookup-tables/hostname-lookup-table';
import { SeqScanLookupTable } from './lookup-tables/seq-scan-lookup-table';
import { type ByteBuffer } from '../utils/byte-buffer';
import { NetworkEngineByteOffsets } from './byte-offsets';

/**
 * NetworkEngine is the engine that supports quick search over network rules.
 */
export class NetworkEngine {
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

    /**
     * Offset of this network engine in the buffer.
     */
    public readonly offset: number;

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
        this.offset = offset;

        this.domainsLookupTable = new DomainsLookupTable(
            storage,
            buffer,
            this.offset + NetworkEngineByteOffsets.DomainsLookupTable,
        );

        this.hostnameLookupTable = new HostnameLookupTable(
            storage,
            buffer,
            this.offset + NetworkEngineByteOffsets.HostnameLookupTable,
        );

        this.shortcutsLookupTable = new TrieLookupTable(
            storage,
            buffer,
            this.offset + NetworkEngineByteOffsets.ShortcutsLookupTable,
        );

        this.seqScanLookupTable = new SeqScanLookupTable(
            storage,
            buffer,
            this.offset + NetworkEngineByteOffsets.SeqScanLookupTable,
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
}
