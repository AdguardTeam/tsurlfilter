import { LRUCache } from 'lru-cache';

import { FilterList, type FilterListConversionError } from '../filterlist/filter-list';
import { FilterRuleList } from '../filterlist/filter-rule-list';
import { type IRuleList } from '../filterlist/rule-list';
import { type NetworkRuleParts, RuleCategory } from '../filterlist/rule-parts';
import { RuleStorage } from '../filterlist/rule-storage';
import { ScannerType } from '../filterlist/scanner/scanner-type';
import { Request } from '../request';
import { RequestType } from '../request-type';
import { type NetworkRule, NetworkRuleOption, type WrittenRuleTextResolver } from '../rules/network-rule';
import { NETWORK_RULE_OPTIONS } from '../rules/network-rule-options';
import {
    type IndexedStorageCosmeticRuleParts,
    type IndexedStorageNetworkRuleParts,
    type IndexedStorageRuleParts,
} from '../rules/rule';

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
     * Filter list content. Can be either a string or a {@link FilterList}.
     */
    content: string | FilterList;

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
     * Storage indexes of potential document or stealth exceptions, including their badfilter rules.
     */
    private readonly documentOrStealthExceptionIndexes: number[];

    /**
     * Resolves the text of a rule as written in the filter list.
     */
    private readonly resolveWrittenText: WrittenRuleTextResolver;

    /**
     * Request results cache.
     */
    private readonly resultCache: LRUCache<string, MatchingResult>;

    /**
     * Conversion errors that occurred during filter list processing.
     */
    private conversionErrors: FilterListConversionError[] = [];

    /**
     * Creates an instance of the network engine in sync mode.
     *
     * @param options Engine factory options.
     *
     * @returns An instance of the network engine.
     */
    public static createSync(options: EngineFactoryOptions): Engine {
        const networkRulesParts: IndexedStorageNetworkRuleParts[] = [];
        const cosmeticRulesParts: IndexedStorageCosmeticRuleParts[] = [];
        const documentOrStealthExceptionIndexes: number[] = [];

        const lists: IRuleList[] = [];
        const conversionErrors: FilterListConversionError[] = [];

        for (const filter of options.filters) {
            let list: FilterList;

            if (filter.content instanceof FilterList) {
                list = filter.content;
            } else {
                list = new FilterList(filter.content, filter.id);
            }

            conversionErrors.push(...list.getConversionErrors());

            const ruleList = new FilterRuleList(
                filter.id,
                list,
                filter.ignoreCosmetic ?? false,
                filter.ignoreJS ?? false,
                filter.ignoreUnsafe ?? false,
            );

            lists.push(ruleList);
        }

        const storage = new RuleStorage(lists);
        const scanner = storage.createRuleStorageScanner(ScannerType.NetworkRules | ScannerType.CosmeticRules);

        while (scanner.scan()) {
            const indexedRuleParts = scanner.getRuleParts();

            if (!indexedRuleParts) {
                continue;
            }

            Engine.collectRuleParts(
                indexedRuleParts,
                networkRulesParts,
                cosmeticRulesParts,
                documentOrStealthExceptionIndexes,
            );
        }

        const networkEngine = NetworkEngine.createSync(networkRulesParts, storage);
        const cosmeticEngine = CosmeticEngine.createSync(cosmeticRulesParts, storage);

        const engine = new Engine(
            storage,
            networkEngine,
            cosmeticEngine,
            conversionErrors,
            documentOrStealthExceptionIndexes,
        );

        return engine;
    }

    /**
     * Creates an instance of the network engine in async mode.
     *
     * @param options Engine factory options.
     *
     * @returns An instance of the network engine.
     */
    public static async createAsync(options: EngineFactoryOptions): Promise<Engine> {
        const networkRulesParts: IndexedStorageNetworkRuleParts[] = [];
        const cosmeticRulesParts: IndexedStorageCosmeticRuleParts[] = [];
        const documentOrStealthExceptionIndexes: number[] = [];

        const lists: IRuleList[] = [];
        const conversionErrors: FilterListConversionError[] = [];

        for (const filter of options.filters) {
            let list: FilterList;

            if (filter.content instanceof FilterList) {
                list = filter.content;
            } else {
                list = new FilterList(filter.content, filter.id);
            }

            conversionErrors.push(...list.getConversionErrors());

            const ruleList = new FilterRuleList(
                filter.id,
                list,
                filter.ignoreCosmetic ?? false,
                filter.ignoreJS ?? false,
                filter.ignoreUnsafe ?? false,
            );

            lists.push(ruleList);
        }

        const storage = new RuleStorage(lists);
        const scanner = storage.createRuleStorageScanner(ScannerType.NetworkRules | ScannerType.CosmeticRules);

        let counter = 0;

        while (scanner.scan()) {
            counter += 1;

            if (counter >= CHUNK_SIZE) {
                counter = 0;

                // Pause rule scanning and let the browser handle pending UI
                // updates (repaints, user input, etc.) before continuing.
                // We use setTimeout (macrotask) instead of Promise.resolve()
                // (microtask) because microtasks don't give the browser a
                // chance to refresh the screen or respond to user actions.
                // eslint-disable-next-line no-await-in-loop
                await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
            }

            const ruleParts = scanner.getRuleParts();

            if (!ruleParts) {
                continue;
            }

            Engine.collectRuleParts(
                ruleParts,
                networkRulesParts,
                cosmeticRulesParts,
                documentOrStealthExceptionIndexes,
            );
        }

        const [networkEngine, cosmeticEngine] = await Promise.all([
            NetworkEngine.createAsync(networkRulesParts, storage),
            CosmeticEngine.createAsync(cosmeticRulesParts, storage),
        ]);

        const engine = new Engine(
            storage,
            networkEngine,
            cosmeticEngine,
            conversionErrors,
            documentOrStealthExceptionIndexes,
        );

        return engine;
    }

    /**
     * Collects rule parts for matching engines and indexes potential document or stealth exceptions.
     *
     * @param indexedRuleParts Scanned rule parts with their storage index.
     * @param networkRulesParts Collected network rule parts.
     * @param cosmeticRulesParts Collected cosmetic rule parts.
     * @param documentOrStealthExceptionIndexes Collected candidate storage indexes.
     */
    private static collectRuleParts(
        indexedRuleParts: IndexedStorageRuleParts,
        networkRulesParts: IndexedStorageNetworkRuleParts[],
        cosmeticRulesParts: IndexedStorageCosmeticRuleParts[],
        documentOrStealthExceptionIndexes: number[],
    ): void {
        if (indexedRuleParts.ruleParts.category === RuleCategory.Network) {
            // The category identifies the network rule parts.
            networkRulesParts.push(indexedRuleParts as IndexedStorageNetworkRuleParts);

            if (Engine.isDocumentOrStealthExceptionCandidate(indexedRuleParts.ruleParts)) {
                documentOrStealthExceptionIndexes.push(indexedRuleParts.index);
            }
        } else if (indexedRuleParts.ruleParts.category === RuleCategory.Cosmetic) {
            // The category identifies the cosmetic rule parts.
            cosmeticRulesParts.push(indexedRuleParts as IndexedStorageCosmeticRuleParts);
        }
    }

    /**
     * Checks modifier text for potential stealth or document exceptions before parsing.
     *
     * @param ruleParts Network rule parts.
     *
     * @returns Whether the rule may disable document filtering or stealth features.
     */
    private static isDocumentOrStealthExceptionCandidate(ruleParts: NetworkRuleParts): boolean {
        if (!ruleParts.allowlist || ruleParts.modifiersStart === undefined) {
            return false;
        }

        const modifiers = ruleParts.text.slice(ruleParts.modifiersStart, ruleParts.modifiersEnd);
        return modifiers.includes(NETWORK_RULE_OPTIONS.STEALTH) || modifiers.includes(NETWORK_RULE_OPTIONS.DOCUMENT);
    }

    /**
     * Creates an instance of an Engine
     * Parses the filtering rules and creates a filtering engine of them.
     *
     * @param ruleStorage Storage.
     * @param networkEngine Network engine.
     * @param cosmeticEngine Cosmetic engine.
     * @param conversionErrors Conversion errors.
     * @param documentOrStealthExceptionIndexes Storage indexes of potential document or stealth exceptions.
     */
    private constructor(
        ruleStorage: RuleStorage,
        networkEngine: NetworkEngine,
        cosmeticEngine: CosmeticEngine,
        conversionErrors: FilterListConversionError[],
        documentOrStealthExceptionIndexes: number[],
    ) {
        this.ruleStorage = ruleStorage;
        this.documentOrStealthExceptionIndexes = documentOrStealthExceptionIndexes;
        this.networkEngine = networkEngine;
        this.cosmeticEngine = cosmeticEngine;
        this.resolveWrittenText = ruleStorage.createWrittenTextResolver();
        this.resultCache = new LRUCache({ max: Engine.REQUEST_CACHE_SIZE });
        this.conversionErrors = conversionErrors;
    }

    /**
     * Returns exceptions with a `$stealth` or `$document` modifier, selected by a build-time
     * substring prefilter on the converted rule text, so `$doc` counts as `$document`.
     * An equivalent exception spelled out as `$elemhide,content,urlblock,jsinject` is not collected.
     * Rules cancelled by `$badfilter` and the `$badfilter` rules themselves are excluded.
     *
     * @returns Document or stealth exception rules with `$badfilter` applied.
     */
    public getDocumentOrStealthExceptionRules(): NetworkRule[] {
        const rules: NetworkRule[] = [];

        for (const index of this.documentOrStealthExceptionIndexes) {
            const rule = this.ruleStorage.retrieveNetworkRule(index);
            if (rule) {
                rules.push(rule);
            }
        }

        return MatchingResult.removeBadfilterRules(rules, this.resolveWrittenText).filter((rule) => {
            return rule.isOptionEnabled(NetworkRuleOption.Stealth) || rule.isFilteringDisabled();
        });
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
        const result = new MatchingResult(networkRules, frameRule, this.resolveWrittenText);
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

        sourceRules = MatchingResult.removeBadfilterRules(sourceRules, this.resolveWrittenText);

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

    /**
     * Retrieves the original rule text by its filter list identifier and rule index.
     *
     * @param filterId Filter list identifier.
     * @param ruleIndex Rule index.
     *
     * @returns Rule text or `null`.
     */
    public retrieveOriginalRuleText(filterId: number, ruleIndex: number): string | null {
        return this.ruleStorage.retrieveOriginalRuleText(filterId, ruleIndex);
    }

    /**
     * Gets the conversion errors that occurred during filter list processing.
     *
     * @returns Array of conversion errors.
     */
    public getConversionErrors(): readonly FilterListConversionError[] {
        return this.conversionErrors;
    }
}
