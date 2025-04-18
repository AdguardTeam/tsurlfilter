import { type RuleStorage } from '../filterlist/rule-storage';
import { NetworkRule } from '../rules/network-rule';
import { HostRule } from '../rules/host-rule';
import { fastHash } from '../utils/string-utils';
import { ScannerType } from '../filterlist/scanner/scanner-type';
import { DnsEngine } from './dns-engine';
import { type Builder } from './builder';
import { NetworkEngineBuilder } from './network-engine-builder';
import { type IndexedStorageRule } from '../rules/rule';
import { type ByteBuffer } from '../utils/byte-buffer';
import { BinaryMultiMap } from '../utils/binary-multimap';
import { DnsEngineByteOffsets } from './byte-offsets';

/**
 * DNSEngine combines host rules and network rules and is supposed to quickly find
 * matching rules for hostnames.
 * First, it looks over network rules and returns first rule found.
 * Then, if nothing found, it looks up the host rules.
 */
export class DnsEngineBuilder implements Builder<DnsEngine> {
    private built = false;

    /**
     * Count of rules added to the engine.
     */
    public rulesCount: number;

    /**
     * Storage.
     */
    private readonly storage: RuleStorage;

    /**
     * Lookup table. Key is the hostname hash.
     */
    private readonly lookupTable: Map<number, number[]>;

    /**
     * Network engine instance.
     */
    private readonly networkEngineBuilder: NetworkEngineBuilder;

    /**
     * Builds an instance of dns engine.
     *
     * @param storage Rule storage.
     */
    constructor(storage: RuleStorage) {
        this.storage = storage;
        this.rulesCount = 0;
        this.lookupTable = new Map<number, number[]>();

        this.networkEngineBuilder = new NetworkEngineBuilder(storage);

        const scanner = this.storage.createRuleStorageScanner(ScannerType.HostRules);

        while (scanner.scan()) {
            const indexedRule = scanner.getRule();
            if (indexedRule) {
                if (indexedRule.rule instanceof HostRule) {
                    this.addRule(indexedRule);
                } else if (indexedRule.rule instanceof NetworkRule
                && indexedRule.rule.isHostLevelNetworkRule()) {
                    this.networkEngineBuilder.addRule(indexedRule);
                }
            }
        }
    }

    /**
     * Adds rule to engine.
     *
     * @param rule Rule to add.
     */
    public addRule(rule: IndexedStorageRule): void {
        if (this.built) {
            throw new Error('Cannot add rule after building the engine');
        }

        if (!(rule.rule instanceof HostRule)) {
            return;
        }

        rule.rule.getHostnames().forEach((hostname) => {
            const hash = fastHash(hostname);

            // Add the rule to the lookup table
            let rulesIndexes = this.lookupTable.get(hash);
            if (!rulesIndexes) {
                rulesIndexes = [];
            }
            rulesIndexes.push(rule.index);

            this.lookupTable.set(hash, rulesIndexes);
        });

        this.rulesCount += 1;
    }

    public build(buffer: ByteBuffer): DnsEngine {
        if (this.built) {
            throw new Error('Cannot build the dns engine after it has been built');
        }

        const offset = buffer.byteOffset;

        // allocate space for the offsets
        buffer.addUint32(offset + DnsEngineByteOffsets.RulesCount, DnsEngineByteOffsets.RulesCount);
        buffer.addUint32(offset + DnsEngineByteOffsets.LookupTable, DnsEngineByteOffsets.LookupTable);
        buffer.addUint32(offset + DnsEngineByteOffsets.NetworkEngine, DnsEngineByteOffsets.NetworkEngine);

        // rules count
        buffer.setUint32(offset + DnsEngineByteOffsets.RulesCount, this.rulesCount);

        // lookup table
        buffer.setUint32(offset + DnsEngineByteOffsets.LookupTable, buffer.byteOffset);
        BinaryMultiMap.create(this.lookupTable, buffer);

        // network engine
        buffer.setUint32(offset + DnsEngineByteOffsets.NetworkEngine, buffer.byteOffset);
        this.networkEngineBuilder.build(buffer);

        this.built = true;

        return new DnsEngine(this.storage, buffer, offset);
    }
}
