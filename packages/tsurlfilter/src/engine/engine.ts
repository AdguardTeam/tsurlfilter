/* eslint-disable no-await-in-loop */
/* eslint-disable no-promise-executor-return */
import { LRUCache } from 'lru-cache';

import { CosmeticEngine } from './cosmetic-engine/cosmetic-engine';
import { MatchingResult } from './matching-result';
import { NetworkEngine } from './network-engine';
import { Request } from '../request';
import { RequestType } from '../request-type';
import { RuleStorage } from '../filterlist/rule-storage';
import { RuleType } from '../filterlist/tokenize';
import { ScannerType } from '../filterlist/scanner/scanner-type';
import { StringRuleList } from '../filterlist/string-rule-list';
import { type CosmeticOption } from './cosmetic-option';
import { type CosmeticResult } from './cosmetic-engine/cosmetic-result';
import { type IndexedStorageRule } from '../rules/rule';
import { type NetworkRule } from '../rules/network-rule';

/**
 * Filter list.
 */
interface FilterList {
    /**
     * Filter list identifier.
     */
    id: number;

    /**
     * Filter list text.
     */
    text: string;

    /**
     * Whether to ignore cosmetic rules from this filter list.
     */
    ignoreCosmetic?: boolean;

    /**
     * Whether to ignore network rules from this filter list.
     */
    ignoreNetwork?: boolean;

    /**
     * Whether to ignore unsafe rules from this filter list.
     */
    ignoreUnsafe?: boolean;
}

/**
 * Engine options.
 */
export interface EngineOptions {
    /**
     * List of filters.
     */
    filters: FilterList[];

    /**
     * Whether to skip initial scan.
     */
    skipInitialScan?: boolean;

    /**
     * Request cache size. If not specified, the default value is used, which is 500.
     */
    requestCacheSize?: number;
}

/**
 * Engine represents the filtering engine with all the loaded rules.
 */
export class Engine {
    /**
     * Request's cache size
     * Used as both source rules and others limit.
     * The value is based on benchmark runs.
     */
    private static DEFAULT_REQUEST_CACHE_SIZE = 500;

    /**
     * Basic filtering rules engine.
     */
    private readonly networkEngine: NetworkEngine;

    /**
     * Cosmetic rules engine.
     */
    private readonly cosmeticEngine: CosmeticEngine;

    /**
     * Rules storage.
     */
    private readonly ruleStorage: RuleStorage;

    /**
     * Request results cache.
     */
    private readonly resultCache: LRUCache<string, MatchingResult>;

    /**
     * Creates an instance of an Engine
     * Parses the filtering rules and creates a filtering engine of them.
     *
     * @param options Engine options.
     *
     * @throws Error if options are invalid.
     */
    constructor(options: EngineOptions) {
        const lists = options.filters.map(
            (f) => new StringRuleList(
                f.id,
                f.text,
                f.ignoreCosmetic ?? false,
                f.ignoreNetwork ?? false,
                f.ignoreUnsafe ?? false,
            ),
        );

        this.ruleStorage = new RuleStorage(lists);
        this.networkEngine = new NetworkEngine(this.ruleStorage, options.skipInitialScan ?? false);
        this.cosmeticEngine = new CosmeticEngine(this.ruleStorage, options.skipInitialScan ?? false);
        this.resultCache = new LRUCache({ max: options.requestCacheSize ?? Engine.DEFAULT_REQUEST_CACHE_SIZE });
    }

    /**
     * Loads rules to engine.
     */
    loadRules(): void {
        const scanner = this.ruleStorage.createRuleStorageScanner(ScannerType.NetworkRules | ScannerType.CosmeticRules);

        while (scanner.scan()) {
            this.addRule(scanner.getRule());
        }
    }

    /**
     * Async loads rules to engine.
     *
     * @param chunkSize Size of rules chunk to load at a time.
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
     * @param request Request to check.
     * @param frameRule Source document rule or null.
     *
     * @returns Matching result.
     */
    matchRequest(request: Request, frameRule: NetworkRule | null = null): MatchingResult {
        let cacheKey = `${request.url}#${request.sourceHostname}#${request.requestType}`;

        if (request.method) {
            cacheKey += `#${request.method}`;
        }

        /**
         * Add frame url text to the key to avoid caching,
         * because allowlist rules are not stored in the engine. AG-12694.
         */
        if (frameRule) {
            cacheKey += `#${frameRule.getIndex()}`;
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
     * @param frameUrl The URL of the frame to match.
     *
     * @returns Document-level allowlist rule if found, otherwise null.
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
     * Gets cosmetic result for the specified hostname and cosmetic options.
     *
     * @param request Host to check.
     * @param option Mask of enabled cosmetic types.
     *
     * @returns Cosmetic result.
     */
    getCosmeticResult(request: Request, option: CosmeticOption): CosmeticResult {
        return this.cosmeticEngine.match(request, option);
    }

    /**
     * Gets rules count.
     *
     * @returns The total number of rules.
     */
    public getRulesCount(): number {
        return this.networkEngine.rulesCount + this.cosmeticEngine.rulesCount;
    }

    /**
     * Adds rules to engines.
     *
     * @param indexedRule Rule to add.
     */
    private addRule(indexedRule: IndexedStorageRule | null): void {
        if (indexedRule) {
            const ruleParts = indexedRule.rule;

            if (ruleParts.type === RuleType.Network) {
                this.networkEngine.addRule(ruleParts, indexedRule.index);
            } else if (ruleParts.type === RuleType.Cosmetic) {
                this.cosmeticEngine.addRule(ruleParts, indexedRule.index);
            }
        }
    }
}

// console.time('Engine initialization');
// const engine = new Engine({
//     filters: [{
//         id: 1,
//         text: [
//             '||example.org^',
//             '||example.com^',
//             '||example.net^',
//         ].join('\n'),
//     }],
// });

// engine.loadRules();

// console.timeEnd('Engine initialization');

// console.log(engine.getRulesCount());

// const request = new Request('https://example.org', 'https://example.org', RequestType.Document);
// const result = engine.matchRequest(request);
// console.log(result);
