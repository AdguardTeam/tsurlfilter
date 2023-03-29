/* eslint-disable no-await-in-loop */
/* eslint-disable no-promise-executor-return */
import { LRUMap } from 'lru_map';
import { CosmeticEngine } from './cosmetic-engine/cosmetic-engine';
import { NetworkEngine } from './network-engine';
import { Request } from '../request';
import { MatchingResult } from './matching-result';
import { NetworkRule } from '../rules/network-rule';
import { RuleStorage } from '../filterlist/rule-storage';
import { CosmeticResult } from './cosmetic-engine/cosmetic-result';
import { CosmeticOption } from './cosmetic-option';
import { ScannerType } from '../filterlist/scanner/scanner-type';
import { IndexedStorageRule } from '../rules/rule';
import { CosmeticRule } from '../rules/cosmetic-rule';
import { RequestType } from '../request-type';

/**
 * Engine represents the filtering engine with all the loaded rules
 */
export class Engine {
    /**
     * Request's cache size
     * Used as both source rules and others limit.
     * The value is based on benchmark runs.
     */
    private static REQUEST_CACHE_SIZE = 500;

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
     * Request results cache
     */
    private readonly resultCache: LRUMap<string, MatchingResult>;

    /**
     * Creates an instance of an Engine
     * Parses the filtering rules and creates a filtering engine of them
     *
     * @param ruleStorage storage
     * @param skipStorageScan create an instance without storage scanning
     * @throws
     */
    constructor(ruleStorage: RuleStorage, skipStorageScan = false) {
        this.ruleStorage = ruleStorage;
        this.networkEngine = new NetworkEngine(ruleStorage, skipStorageScan);
        this.cosmeticEngine = new CosmeticEngine(ruleStorage, skipStorageScan);
        this.resultCache = new LRUMap<string, MatchingResult>(Engine.REQUEST_CACHE_SIZE);
    }

    /**
     * Loads rules to engine
     */
    loadRules(): void {
        const scanner = this.ruleStorage.createRuleStorageScanner(ScannerType.NetworkRules | ScannerType.CosmeticRules);

        while (scanner.scan()) {
            this.addRule(scanner.getRule());
        }
    }

    /**
     * Async loads rules to engine
     *
     * @param chunkSize size of rules chunk to load at a time
     */
    async loadRulesAsync(chunkSize: number): Promise<void> {
        const scanner = this.ruleStorage.createRuleStorageScanner(ScannerType.NetworkRules | ScannerType.CosmeticRules);

        let counter = 0;
        while (scanner.scan()) {
            counter += 1;

            if (counter >= chunkSize) {
                counter = 0;

                /**
                 * In some cases UI thread becomes blocked while adding rules to engine,
                 * that't why we create filter rules using chunks of the specified length
                 * Rules creation is rather slow operation so we should
                 * use setTimeout calls to give UI thread some time.
                 */
                await new Promise((resolve) => setTimeout(resolve, 1));
            }

            this.addRule(scanner.getRule());
        }
    }

    /**
     * Matches the specified request against the filtering engine and returns the matching result.
     *
     * @param request - request to check
     * @param frameRule - source document rule or null
     * @return matching result
     */
    matchRequest(request: Request, frameRule: NetworkRule | null = null): MatchingResult {
        let cacheKey = `${request.url}#${request.sourceHostname}#${request.requestType}`;

        /**
         * Add frame url text to the key to avoid caching,
         * because allowlist rules are not stored in the engine
         * AG-12694
         */
        if (frameRule) {
            cacheKey += `#${frameRule.getText()}`;
        }

        const res = this.resultCache.get(cacheKey);
        if (res) {
            return res;
        }

        const networkRules = this.networkEngine.matchAll(request);
        const result = new MatchingResult(networkRules, frameRule);
        this.resultCache.set(cacheKey, result);
        return result;
    }

    /**
     * Matches current frame and returns document-level allowlist rule if found.
     *
     * @param frameUrl
     */
    matchFrame(frameUrl: string): NetworkRule | null {
        const sourceRequest = new Request(frameUrl, '', RequestType.Document);
        let sourceRules = this.networkEngine.matchAll(sourceRequest);

        sourceRules = MatchingResult.removeBadfilterRules(sourceRules);

        let result: NetworkRule | null = null;
        sourceRules.forEach((r) => {
            if (r.isDocumentLevelAllowlistRule()) {
                if (!result || r.isHigherPriority(result)) {
                    result = r;
                }
            }
        });

        return result;
    }

    /**
     * Gets cosmetic result for the specified hostname and cosmetic options
     *
     * @param request host to check
     * @param option mask of enabled cosmetic types
     * @return cosmetic result
     */
    getCosmeticResult(request: Request, option: CosmeticOption): CosmeticResult {
        return this.cosmeticEngine.match(request, option);
    }

    /**
     * Gets rules count
     */
    getRulesCount(): number {
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
                this.cosmeticEngine.addRule(indexedRule.rule, indexedRule.index);
            }
        }
    }
}
