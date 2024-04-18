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
    declare private ruleCountPosition: number;

    public get rulesCount(): number {
        return this.byteBuffer.getUint32(this.ruleCountPosition);
    }

    private set rulesCount(value: number) {
        this.byteBuffer.setUint32(this.ruleCountPosition, value);
    }

    /**
     * Storage
     */
    private ruleStorage: RuleStorage;

    /**
     * Lookup table. Key is the hostname hash.
     */
    private readonly lookupTable: Map<number, number>;

    /**
     * Network engine instance
     */
    declare private readonly networkEngine: NetworkEngine;

    /**
     * ByteBuffer to store the binary data.
     */
    declare private readonly byteBuffer: ByteBuffer;

    /**
     * Position of the storage indexes list in the byte buffer.
     */
    declare private readonly storageIndexesListPosition: number;

    /**
     * Position of the binary map in the byte buffer.
     */
    declare private binaryMapPosition: number;

    /**
     * Builds an instance of dns engine
     *
     * @param storage
     * @param buffer
     */
    constructor(storage: RuleStorage, buffer: ByteBuffer) {
        this.ruleStorage = storage;
        this.lookupTable = new Map<number, number>();

        this.byteBuffer = buffer;
        this.pushRulesCountToBuffer();
        this.storageIndexesListPosition = U32LinkedList.create(this.byteBuffer);
        this.networkEngine = new NetworkEngine(storage, this.byteBuffer, true);

        const scanner = this.ruleStorage.createRuleStorageScanner(ScannerType.HostRules);

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

    private pushRulesCountToBuffer() {
        this.ruleCountPosition = this.byteBuffer.byteOffset;
        this.byteBuffer.addUint32(this.ruleCountPosition, 0);
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
