import { RuleStorage } from '../filterlist/rule-storage';
import { NetworkRule } from '../rules/network-rule';
import { HostRule } from '../rules/host-rule';
import { fastHash } from '../utils/utils';
import { NetworkEngine } from './network-engine';
import { Request, RequestType } from '../request';
import { DnsResult } from './dns-result';
import { ScannerType } from '../filterlist/scanner/scanner-type';

/**
 * DNSEngine combines host rules and network rules and is supposed to quickly find
 * matching rules for hostnames.
 * First, it looks over network rules and returns first rule found.
 * Then, if nothing found, it looks up the host rules.
 */
export class DnsEngine {
    /**
     * Count of rules added to the engine
     */
    public rulesCount: number;

    /**
     * Storage
     */
    private ruleStorage: RuleStorage;

    /**
     * Lookup table. Key is the hostname hash.
     */
    private readonly lookupTable: Map<number, string[]>;

    /**
     * Network engine instance
     */
    private readonly networkEngine: NetworkEngine;

    /**
     * Builds an instance of dns engine
     *
     * @param storage
     */
    constructor(storage: RuleStorage) {
        this.ruleStorage = storage;
        this.rulesCount = 0;
        this.lookupTable = new Map<number, string[]>();

        this.networkEngine = new NetworkEngine(storage, true);

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
        const rulesIndexes = this.lookupTable.get(hash);
        if (rulesIndexes) {
            rulesIndexes.forEach((ruleIdx) => {
                const rule = this.ruleStorage.retrieveHostRule(ruleIdx);
                if (rule && rule.match(hostname)) {
                    result.hostRules.push(rule);
                }
            });
        }

        return result;
    }

    /**
     * Adds rule to engine
     *
     * @param rule
     * @param storageIdx
     */
    private addRule(rule: HostRule, storageIdx: string): void {
        rule.getHostnames().forEach((hostname) => {
            const hash = fastHash(hostname);

            // Add the rule to the lookup table
            let rulesIndexes = this.lookupTable.get(hash);
            if (!rulesIndexes) {
                rulesIndexes = [];
            }
            rulesIndexes.push(storageIdx);

            this.lookupTable.set(hash, rulesIndexes);
        });

        this.rulesCount += 1;
    }
}
