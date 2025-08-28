import { RawFilterListConverter } from '@adguard/agtree';
import { LRUCache } from 'lru-cache';

import { type IRuleList } from '../filterlist/rule-list-new';
import { RuleCategory } from '../filterlist/rule-parts';
import { RuleStorage } from '../filterlist/rule-storage-new';
import { ScannerType } from '../filterlist/scanner/scanner-type';
import { StringRuleList } from '../filterlist/string-rule-list';
import { Request } from '../request';
import { RequestType } from '../request-type';
import { type NetworkRule } from '../rules/network-rule';
import { type IndexedStorageRule } from '../rules/rule-new';

import { CHUNK_SIZE } from './constants';
import { CosmeticEngine } from './cosmetic-engine/cosmetic-engine';
import { type CosmeticResult } from './cosmetic-engine/cosmetic-result';
import { type CosmeticOption } from './cosmetic-option';
import { MatchingResult } from './matching-result';
import { NetworkEngine } from './network-engine';

/**
 * Filter list for engine factory.
 */
export interface EngineFactoryFilterList {
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
     * Whether to ignore javascript rules from this filter list.
     */
    ignoreJS?: boolean;

    /**
     * Whether to ignore unsafe rules from this filter list.
     */
    ignoreUnsafe?: boolean;
}

/**
 * Engine factory options.
 */
export interface EngineFactoryOptions {
    /**
     * List of filters.
     */
    filters: EngineFactoryFilterList[];
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
    private static readonly REQUEST_CACHE_SIZE = 500;

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
     * Creates an instance of the network engine in sync mode.
     * Sync mode converts all rules before creating the engine.
     *
     * @param options Engine factory options.
     *
     * @returns An instance of the network engine.
     */
    public static createSync(options: EngineFactoryOptions): Engine {
        const networkRules: IndexedStorageRule[] = [];
        const cosmeticRules: IndexedStorageRule[] = [];

        const lists: IRuleList[] = [];

        for (const filter of options.filters) {
            const list = new StringRuleList(
                filter.id,
                RawFilterListConverter.convertToAdg(filter.text).result,
                filter.ignoreCosmetic ?? false,
                filter.ignoreJS ?? false,
                filter.ignoreUnsafe ?? false,
            );

            lists.push(list);
        }

        const storage = new RuleStorage(lists);
        const scanner = storage.createRuleStorageScanner(ScannerType.NetworkRules | ScannerType.CosmeticRules);

        while (scanner.scan()) {
            const rule = scanner.getRule();

            if (!rule) {
                continue;
            }

            if (rule.rule.category === RuleCategory.Network) {
                networkRules.push(rule);
            } else if (rule.rule.category === RuleCategory.Cosmetic) {
                cosmeticRules.push(rule);
            }
        }

        const networkEngine = NetworkEngine.createSync(storage, networkRules);
        const cosmeticEngine = CosmeticEngine.createSync(storage, cosmeticRules);

        return new Engine(storage, networkEngine, cosmeticEngine);
    }

    /**
     * Creates an instance of the network engine in async mode.
     * Async mode does not convert rules before creating the engine.
     *
     * @param options Engine factory options.
     *
     * @returns An instance of the network engine.
     */
    public static async createAsync(options: EngineFactoryOptions): Promise<Engine> {
        const networkRules: IndexedStorageRule[] = [];
        const cosmeticRules: IndexedStorageRule[] = [];

        const lists: IRuleList[] = [];

        for (const filter of options.filters) {
            const list = new StringRuleList(
                filter.id,
                filter.text,
                filter.ignoreCosmetic ?? false,
                filter.ignoreJS ?? false,
                filter.ignoreUnsafe ?? false,
            );

            lists.push(list);
        }

        const storage = new RuleStorage(lists);
        const scanner = storage.createRuleStorageScanner(ScannerType.NetworkRules | ScannerType.CosmeticRules);

        let counter = 0;

        while (scanner.scan()) {
            counter += 1;

            if (counter >= CHUNK_SIZE) {
                counter = 0;

                // eslint-disable-next-line no-await-in-loop, no-promise-executor-return
                await new Promise((resolve) => setTimeout(resolve, 1));
            }

            const rule = scanner.getRule();

            if (!rule) {
                continue;
            }

            if (rule.rule.category === RuleCategory.Network) {
                networkRules.push(rule);
            } else if (rule.rule.category === RuleCategory.Cosmetic) {
                cosmeticRules.push(rule);
            }
        }

        const [networkEngine, cosmeticEngine] = await Promise.all([
            NetworkEngine.createAsync(storage, networkRules),
            CosmeticEngine.createAsync(storage, cosmeticRules),
        ]);

        return new Engine(storage, networkEngine, cosmeticEngine);
    }

    /**
     * Creates an instance of an Engine
     * Parses the filtering rules and creates a filtering engine of them.
     *
     * @param ruleStorage Storage.
     * @param networkEngine Network engine.
     * @param cosmeticEngine Cosmetic engine.
     *
     * @throws
     */
    private constructor(
        ruleStorage: RuleStorage,
        networkEngine: NetworkEngine,
        cosmeticEngine: CosmeticEngine,
    ) {
        this.ruleStorage = ruleStorage;
        this.networkEngine = networkEngine;
        this.cosmeticEngine = cosmeticEngine;
        this.resultCache = new LRUCache({ max: Engine.REQUEST_CACHE_SIZE });
    }

    /**
     * Matches the specified request against the filtering engine and returns the matching result.
     *
     * @param request Request to check.
     * @param frameRule Source document rule or null.
     *
     * @returns Matching result.
     */
    public matchRequest(request: Request, frameRule: NetworkRule | null = null): MatchingResult {
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
    // TODO: Find a better name for this method
    public matchFrame(frameUrl: string): NetworkRule | null {
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
    public getCosmeticResult(request: Request, option: CosmeticOption): CosmeticResult {
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
     * Retrieves a rule text by its filter list identifier and rule index.
     *
     * If there's no rule by that index or the rule structure is invalid, it will return null.
     *
     * @param filterId Filter list identifier.
     * @param ruleIndex Rule index.
     *
     * @returns Rule text or `null`.
     */
    public retrieveRuleText(filterId: number, ruleIndex: number): string | null {
        return this.ruleStorage.retrieveRuleText(filterId, ruleIndex);
    }
}
