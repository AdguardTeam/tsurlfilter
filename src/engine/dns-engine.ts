import { RuleStorage } from '../filterlist/rule-storage';
import { NetworkRule } from '../rules/network-rule';
import { HostRule } from '../rules/host-rule';
import { fastHash } from '../utils/utils';

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
    private readonly lookupTable: Map<number, number[]>;

    /**
     * Builds an instance of dns engine
     *
     * @param storage
     */
    constructor(storage: RuleStorage) {
        this.ruleStorage = storage;
        this.rulesCount = 0;
        this.lookupTable = new Map<number, number[]>();

        const scanner = this.ruleStorage.createRuleStorageScanner();

        while (scanner.scan()) {
            const indexedRule = scanner.getRule();
            if (indexedRule) {
                if (indexedRule.rule instanceof HostRule) {
                    this.addRule(indexedRule.rule, indexedRule.index);
                } else if (indexedRule.rule instanceof NetworkRule
                && DnsEngine.isHostLevelNetworkRule(indexedRule.rule)) {
                    // TODO: Convert to HostRule
                    // this.addRule(indexedRule.rule, indexedRule.index);
                }
            }
        }
    }

    /**
     * Match searches over all filtering rules loaded to the engine
     * It returns rule if a match was found alongside the matching rule
     *
     * @param hostname to check
     * @return rules matching
     */
    public match(hostname: string): HostRule[] {
        const result: HostRule[] = [];
        if (!hostname) {
            return result;
        }

        const hash = fastHash(hostname);
        const rulesIndexes = this.lookupTable.get(hash);
        if (rulesIndexes) {
            rulesIndexes.forEach((ruleIdx) => {
                // TODO: Retrieve rule, then if it's network rule - convert to hostrule
                const rule = this.ruleStorage.retrieveHostRule(ruleIdx);
                if (rule && rule.match(hostname)) {
                    result.push(rule);
                }
            });
        }

        return result;
    }

    /**
     * Adds rule to the network engine
     *
     * @param rule
     * @param storageIdx
     */
    private addRule(rule: HostRule, storageIdx: number): void {
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private static isHostLevelNetworkRule(rule: NetworkRule): boolean {
        // TODO: Implement isHostLevelNetworkRule

        return false;
    }
}
