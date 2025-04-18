import { type RuleStorage } from '../filterlist/rule-storage';
import { fastHash } from '../utils/string-utils';
import { NetworkEngine } from './network-engine';
import { Request } from '../request';
import { DnsResult } from './dns-result';
import { RequestType } from '../request-type';
import { type ByteBuffer } from '../utils/byte-buffer';
import { DnsEngineByteOffsets } from './byte-offsets';
import { BinaryMultiMap } from '../utils/binary-multimap';

/**
 * DNSEngine combines host rules and network rules and is supposed to quickly find
 * matching rules for hostnames.
 * First, it looks over network rules and returns first rule found.
 * Then, if nothing found, it looks up the host rules.
 */
export class DnsEngine {
    private readonly buffer: ByteBuffer;

    public readonly offset: number;

    private readonly ruleStorage: RuleStorage;

    private readonly networkEngine: NetworkEngine;

    constructor(storage: RuleStorage, buffer: ByteBuffer, offset: number) {
        this.buffer = buffer;
        this.ruleStorage = storage;
        this.networkEngine = new NetworkEngine(storage, buffer, offset + DnsEngineByteOffsets.NetworkEngine);
        this.offset = offset;
    }

    public get rulesCount(): number {
        return this.buffer.getUint32(this.offset + DnsEngineByteOffsets.RulesCount);
    }

    /**
     * Match searches over all filtering and host rules loaded to the engine.
     *
     * @param hostname To check.
     *
     * @returns Dns result object.
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
        const rulesIndexes = BinaryMultiMap.get(hash, this.buffer, this.offset + DnsEngineByteOffsets.LookupTable);
        if (rulesIndexes) {
            for (let j = 0; j < rulesIndexes.length; j += 1) {
                const rule = this.ruleStorage.retrieveHostRule(rulesIndexes[j]);
                if (rule && rule.match(hostname)) {
                    result.hostRules.push(rule);
                }
            }
        }

        return result;
    }
}
