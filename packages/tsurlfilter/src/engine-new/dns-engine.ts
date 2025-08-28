import { type RuleStorage } from '../filterlist/rule-storage-new';
import { ScannerType } from '../filterlist/scanner-new/scanner-type';
import { Request } from '../request';
import { RequestType } from '../request-type';
import { HostRule } from '../rules/host-rule';
import { NetworkRule } from '../rules/network-rule';
import { type IndexedStorageRule } from '../rules/rule-new';
import { fastHash } from '../utils/string-utils';

import { DnsResult } from './dns-result';
import { NetworkEngine } from './network-engine';

/**
 * DNSEngine combines host rules and network rules and is supposed to quickly find
 * matching rules for hostnames.
 * First, it looks over network rules and returns first rule found.
 * Then, if nothing found, it looks up the host rules.
 */
export class DnsEngine {
    /**
     * Count of rules added to the engine.
     */
    public rulesCount: number;

    /**
     * Storage.
     */
    private ruleStorage: RuleStorage;

    /**
     * Lookup table. Key is the hostname hash.
     */
    private readonly lookupTable: Map<number, number[]>;

    /**
     * Network engine instance.
     */
    private readonly networkEngine: NetworkEngine;

    /**
     * Builds an instance of dns engine.
     *
     * @param storage Rule storage.
     */
    constructor(storage: RuleStorage) {
        this.ruleStorage = storage;
        this.rulesCount = 0;
        this.lookupTable = new Map<number, number[]>();

        const scanner = this.ruleStorage.createRuleStorageScanner(ScannerType.HostRules);
        const networkRules: IndexedStorageRule[] = [];

        while (scanner.scan()) {
            // FIXME (David): we do not use rule parts here, but tokenizer is always called
            const indexedRule = scanner.getRule();
            if (!indexedRule) {
                continue;
            }

            // TODO: Get rid of full parsing here
            const rule = this.ruleStorage.retrieveRule(indexedRule.index, false);
            if (rule instanceof HostRule) {
                this.addRule(rule, indexedRule.index);
            } else if (rule instanceof NetworkRule && rule.isHostLevelNetworkRule()) {
                // Note: it is safe to cast here, because we checked rule type
                networkRules.push(indexedRule);
            }
        }

        this.networkEngine = NetworkEngine.createSync(storage, networkRules);
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
        const rulesIndexes = this.lookupTable.get(hash);
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

    /**
     * Adds rule to engine.
     *
     * @param rule Rule to add.
     * @param storageIdx Storage index of the rule.
     */
    private addRule(rule: HostRule, storageIdx: number): void {
        rule.getHostnames().forEach((hostname) => {
            const hash = fastHash(hostname);

            // Add the rule to the lookup table
            let rulesIndexes = this.lookupTable.get(hash);
            if (!rulesIndexes) {
                rulesIndexes = [];
                this.lookupTable.set(hash, rulesIndexes);
            }
            rulesIndexes.push(storageIdx);
        });

        this.rulesCount += 1;
    }
}
