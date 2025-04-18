import { LRUCache } from 'lru-cache';
import { type AnyRule } from '@adguard/agtree';
import { CosmeticEngine } from './cosmetic-engine/cosmetic-engine';
import { NetworkEngine } from './network-engine';
import { Request } from '../request';
import { MatchingResult } from './matching-result';
import { type NetworkRule } from '../rules/network-rule';
import { type RuleStorage } from '../filterlist/rule-storage';
import { type CosmeticResult } from './cosmetic-engine/cosmetic-result';
import { type CosmeticOption } from './cosmetic-option';
import { RequestType } from '../request-type';
import { EngineByteOffsets } from './byte-offsets';
import { type ByteBuffer } from '../utils/byte-buffer';

/**
 * Engine represents the filtering engine with all the loaded rules.
 */
export class Engine {
    private readonly buffer: ByteBuffer;

    public readonly offset: number;

    /**
     * Request's cache size
     * Used as both source rules and others limit.
     * The value is based on benchmark runs.
     */
    private static REQUEST_CACHE_SIZE = 500;

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
    private readonly storage: RuleStorage;

    /**
     * Request results cache.
     */
    private readonly resultCache: LRUCache<string, MatchingResult>;

    constructor(storage: RuleStorage, buffer: ByteBuffer, offset: number) {
        this.storage = storage;
        this.buffer = buffer;
        this.offset = offset;
        this.networkEngine = new NetworkEngine(storage, buffer, offset + EngineByteOffsets.NetworkEngine);
        this.cosmeticEngine = new CosmeticEngine(storage, buffer, offset + EngineByteOffsets.CosmeticEngine);
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
     * Retrieves a rule node by its filter list identifier and rule index.
     *
     * If there's no rule by that index or the rule structure is invalid, it will return null.
     *
     * @param filterId Filter list identifier.
     * @param ruleIndex Rule index.
     *
     * @returns Rule node or `null`.
     */
    public retrieveRuleNode(filterId: number, ruleIndex: number): AnyRule | null {
        return this.storage.retrieveRuleNode(filterId, ruleIndex);
    }
}
