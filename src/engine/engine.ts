import { CosmeticEngine } from './cosmetic-engine/cosmetic-engine';
import { NetworkEngine } from './network-engine';
import { Request, RequestType } from '../request';
import { MatchingResult } from './matching-result';
import { NetworkRule } from '../rules/network-rule';
import { RuleStorage } from '../filterlist/rule-storage';
import { CosmeticResult } from './cosmetic-engine/cosmetic-result';
import { config, IConfiguration } from '../configuration';
import { CosmeticOption } from './cosmetic-option';
import { ScannerType } from '../filterlist/scanner/scanner-type';
import { IndexedStorageRule } from '../rules/rule';
import { CosmeticRule } from '../rules/cosmetic-rule';

/**
 * Engine represents the filtering engine with all the loaded rules
 */
export class Engine {
    /**
     * Basic filtering rules engine
     */
    private readonly networkEngine: NetworkEngine;

    /**
     * Cosmetic rules engine
     */
    private readonly cosmeticEngine: CosmeticEngine;

    /**
     * Rules storage
     */
    private readonly ruleStorage: RuleStorage;

    /**
     * Creates an instance of an Engine
     * Parses the filtering rules and creates a filtering engine of them
     *
     * @param ruleStorage storage
     * @param configuration optional configuration
     * @param skipStorageScan create an instance without storage scanning
     * @throws
     */
    constructor(ruleStorage: RuleStorage, configuration?: IConfiguration | undefined, skipStorageScan = false) {
        if (configuration) {
            config.engine = configuration.engine;
            config.version = configuration.version;
            config.verbose = configuration.verbose;
        }

        this.ruleStorage = ruleStorage;
        this.networkEngine = new NetworkEngine(ruleStorage, skipStorageScan);
        this.cosmeticEngine = new CosmeticEngine(ruleStorage, skipStorageScan);
    }

    /**
     * Loads rules to engine
     *
     * @param chunkSize size of rules chunk to load at a time
     */
    async loadRules(chunkSize = 0): Promise<void> {
        const scanner = this.ruleStorage.createRuleStorageAsyncScanner(
            ScannerType.NetworkRules | ScannerType.CosmeticRules, chunkSize,
        );

        // eslint-disable-next-line no-await-in-loop
        while (await scanner.scanAsync()) {
            this.addRule(scanner.getRule());
        }
    }

    /**
     * Matches the specified request against the filtering engine and returns the matching result.
     *
     * @param request - request to check
     * @return matching result
     */
    matchRequest(request: Request): MatchingResult {
        const networkRules = this.networkEngine.matchAll(request);
        let sourceRules: NetworkRule[] = [];

        if (request.sourceUrl) {
            const sourceRequest = new Request(request.sourceUrl, '', RequestType.Document);
            sourceRules = this.networkEngine.matchAll(sourceRequest);
        }

        return new MatchingResult(networkRules, sourceRules);
    }

    /**
     * Gets cosmetic result for the specified hostname and cosmetic options
     *
     * @param hostname host to check
     * @param option mask of enabled cosmetic types
     * @return cosmetic result
     */
    getCosmeticResult(hostname: string, option: CosmeticOption): CosmeticResult {
        return this.cosmeticEngine.match(hostname, option);
    }

    /**
     * Gets rules count
     */
    getRulesCount() {
        return this.networkEngine.rulesCount + this.cosmeticEngine.rulesCount;
    }

    /**
     * Adds rules to engines
     *
     * @param indexedRule
     */
    private addRule(indexedRule: IndexedStorageRule | null): void {
        if (indexedRule) {
            if (indexedRule.rule instanceof NetworkRule) {
                this.networkEngine.addRule(indexedRule.rule, indexedRule.index);
            } else if (indexedRule.rule instanceof CosmeticRule) {
                this.cosmeticEngine.addRule(indexedRule.rule);
            }
        }
    }
}
