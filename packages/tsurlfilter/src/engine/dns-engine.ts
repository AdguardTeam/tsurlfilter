import { RuleStorage } from '../filterlist/rule-storage';
import { NetworkRule } from '../rules/network-rule';
import { HostRule } from '../rules/host-rule';
import { fastHash } from '../utils/string-utils';
import { NetworkEngine } from './network-engine';
import { Request } from '../request';
import { DnsResult } from './dns-result';
import { ScannerType } from '../filterlist/scanner/scanner-type';
import { RequestType } from '../request-type';
import { BinaryMap } from '../utils/binary-map';
import { U32LinkedList } from '../utils/u32-linked-list';
import type { ByteBuffer } from '../utils/byte-buffer';

/**
 * DNSEngine combines host rules and network rules and is supposed to quickly find
 * matching rules for hostnames.
 * First, it looks over network rules and returns first rule found.
 * Then, if nothing found, it looks up the host rules.
 */
export class DnsEngine {
    /**
     * Reserved pointer value for undefined values.
     */
    private static readonly UNDEFINED_POINTER = 0;

    /**
     * Pointer to the rule counter in the byte buffer.
     */
    private static readonly RULE_COUNTER_POINTER = 4;

    /**
     * Pointer to the storage indexes list position in the byte buffer.
     */
    private static readonly STORAGE_INDEXES_POSITION_POINTER = 8;

    /**
     * Pointer to the binary map position in the byte buffer.
     */
    private static readonly BINARY_MAP_POSITION_POINTER = 12;

    /**
     * Pointer to the network engine position in the byte buffer.
     */
    private static readonly NETWORK_ENGINE_POSITION_POINTER = 16;

    /**
     * Storage
     */
    declare private readonly ruleStorage: RuleStorage;

    /**
     * Lookup table. Key is the hostname hash.
     */
    declare private readonly lookupTable: Map<number, number>;

    /**
     * Network engine instance
     */
    declare private readonly networkEngine: NetworkEngine;

    /**
     * ByteBuffer to store the binary data.
     */
    declare private readonly byteBuffer: ByteBuffer;

    /**
     * Total number of rules in the engine.
     */
    public get rulesCount(): number {
        return this.byteBuffer.getUint32(DnsEngine.RULE_COUNTER_POINTER);
    }

    /** @inheritdoc */
    private set rulesCount(value: number) {
        this.byteBuffer.setUint32(DnsEngine.RULE_COUNTER_POINTER, value);
    }

    /**
     * Position of the binary map in the byte buffer.
     */
    private get binaryMapPosition(): number {
        return this.byteBuffer.getUint32(DnsEngine.BINARY_MAP_POSITION_POINTER);
    }

    /** @inheritdoc */
    private set binaryMapPosition(value: number) {
        this.byteBuffer.setUint32(DnsEngine.BINARY_MAP_POSITION_POINTER, value);
    }

    /**
     * Position of the storage indexes list in the byte buffer.
     */
    private get storageIndexesListPosition(): number {
        return this.byteBuffer.getUint32(DnsEngine.STORAGE_INDEXES_POSITION_POINTER);
    }

    /**
     * Creates an instance of an DnsEngine
     *
     * @param ruleStorage {@link RuleStorage} instance
     * @param buffer Byte buffer to store the binary data.
     * @param networkEngine Network engine.
     * @param skipStorageScan Create an instance without storage scanning.
     */
    constructor(
        storage: RuleStorage,
        buffer: ByteBuffer,
        networkEngine: NetworkEngine,
        skipStorageScan = false,
    ) {
        this.ruleStorage = storage;
        this.lookupTable = new Map<number, number>();
        this.byteBuffer = buffer;
        this.networkEngine = networkEngine;

        const scanner = this.ruleStorage.createRuleStorageScanner(ScannerType.HostRules);

        if (skipStorageScan) {
            return;
        }

        while (scanner.scan()) {
            const indexedRule = scanner.getRule();
            if (indexedRule) {
                if (indexedRule.rule instanceof HostRule) {
                    this.addRule(indexedRule.rule, indexedRule.index);
                } else if (indexedRule.rule instanceof NetworkRule
                    && indexedRule.rule.isHostLevelNetworkRule()) {
                    this.networkEngine.addRule(indexedRule.rule, indexedRule.index);
                }
            }
        }
    }

    /**
     * Initializes the DNS engine with new index structures.
     *
     * @param rulesStorage Rules storage API.
     * @param buffer {@link ByteBuffer} instance.
     * @param skipStorageScan whether to skip storage scan
     * @param skipFinalize whether to skip finalizing the engine
     * @returns New {@link DnsEngine} instance.
     */
    static create(
        rulesStorage: RuleStorage,
        buffer: ByteBuffer,
        skipStorageScan = false,
        skipFinalize = false,
    ) {
        // reserve space for pointers
        buffer.addUint32(DnsEngine.UNDEFINED_POINTER, 0);
        buffer.addUint32(DnsEngine.RULE_COUNTER_POINTER, 0);
        buffer.addUint32(DnsEngine.STORAGE_INDEXES_POSITION_POINTER, 0);
        buffer.addUint32(DnsEngine.BINARY_MAP_POSITION_POINTER, 0);
        buffer.addUint32(DnsEngine.NETWORK_ENGINE_POSITION_POINTER, 0);

        // Create storage indexes list and set its position
        const storageIndexesListPosition = U32LinkedList.create(buffer);
        buffer.setUint32(DnsEngine.STORAGE_INDEXES_POSITION_POINTER, storageIndexesListPosition);

        // Create network engine and set its position
        const networkEngine = NetworkEngine.create(rulesStorage, buffer, true);
        buffer.setUint32(DnsEngine.NETWORK_ENGINE_POSITION_POINTER, networkEngine.offset);

        // Create a new instance of the dns engine
        const engine = new DnsEngine(rulesStorage, buffer, networkEngine, skipStorageScan);

        // We skip building index structures on async initialization
        // and call `finalaze` manually when rules are loaded.
        if (!skipFinalize) {
            engine.finalize();
        }

        return engine;
    }

    /**
     * Restores the engine from persisted buffer data.
     * @param rulesStorage Rules storage API.
     * @param buffer {@link ByteBuffer} instance.
     * @returns New {@link Engine} instance.
     */
    static from(rulesStorage: RuleStorage, buffer: ByteBuffer) {
        const networkEnginePosition = buffer.getUint32(DnsEngine.NETWORK_ENGINE_POSITION_POINTER);
        const networkEngine = new NetworkEngine(rulesStorage, buffer, networkEnginePosition);
        return new DnsEngine(rulesStorage, buffer, networkEngine, true);
    }

    /**
     * Match searches over all filtering and host rules loaded to the engine
     *
     * @param hostname to check
     * @return dns result object
     */
    public match(hostname: string): DnsResult {
        const result = new DnsResult();
        if (!hostname) {
            return result;
        }

        const url = `http://${hostname}/`;
        const request = new Request(url, url, RequestType.Document);
        request.isHostnameRequest = true;

        const networkRule = this.networkEngine.match(request);
        if (networkRule) {
            // Network rules always have higher priority
            result.basicRule = networkRule;
            return result;
        }

        const hash = fastHash(hostname);
        // Get the position of the storage indexes for the hash
        const storageIndexesPosition = BinaryMap.get(hash, this.byteBuffer, this.binaryMapPosition);

        if (storageIndexesPosition !== undefined) {
            // Iterate over the storage indexes and retrieve the rules
            U32LinkedList.forEach((storageIdx) => {
                const rule = this.ruleStorage.retrieveHostRule(storageIdx);

                if (rule && rule.match(hostname)) {
                    result.hostRules.push(rule);
                }
            }, this.byteBuffer, storageIndexesPosition);
        }

        return result;
    }

    public finalize(): void {
        this.networkEngine.finalize();
        this.binaryMapPosition = BinaryMap.create(this.lookupTable, this.byteBuffer);
    }

    /**
     * Adds rule to engine
     *
     * @param rule
     * @param storageIdx
     */
    private addRule(rule: HostRule, storageIdx: number): void {
        rule.getHostnames().forEach((hostname) => {
            const hash = fastHash(hostname);

            // Get the position of the storage indexes for the hash
            let storageIndexesPosition = this.lookupTable.get(hash);

            /**
             * If the hash is not in the lookup table, create a new {@link U32LinkedList},
             * and adds the list position to the {@link storageIndexesListPosition}
             */
            if (storageIndexesPosition === undefined) {
                storageIndexesPosition = U32LinkedList.create(this.byteBuffer);
                U32LinkedList.add(storageIndexesPosition, this.byteBuffer, this.storageIndexesListPosition);
                this.lookupTable.set(hash, storageIndexesPosition);
            }

            // Add the storage index to the related U32LinkedList
            U32LinkedList.add(storageIdx, this.byteBuffer, storageIndexesPosition);
        });

        this.rulesCount += 1;
    }
}
