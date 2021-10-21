import {
    StringRuleList,
    RuleStorage,
    Engine,
    setConfiguration,
    CompatibilityTypes,
    RequestType,
    NetworkRule,
    MatchingResult,
    Request,
    CosmeticResult,
    getHost,
    CosmeticOption,
} from '@adguard/tsurlfilter';

import { Configuration } from './configuration';

/**
 * Request Match Query
 */
export interface MatchQuery{
    requestUrl: string;
    frameUrl: string;
    requestType: RequestType;
    frameRule?: NetworkRule | null;
}

export interface EngineApi {
    startEngine: (configuration: Configuration) => Promise<void>;

    /**
     * Gets matching result for request.
     */
    matchRequest: (matchQuery: MatchQuery) => MatchingResult | null;

    /**
     * Matches current frame url and returns document-level rule if found.
     */
    matchFrame: (frameUrl: string) => NetworkRule | null;

    /**
     * Gets cosmetic result for the specified hostname and cosmetic options
     */
    getCosmeticResult: (url: string, option: CosmeticOption) => CosmeticResult;

    getRulesCount: () => number;
}

/**
 * TSUrlFilter Engine wrapper
 */
export const engineApi = (function (): EngineApi {
    const ASYNC_LOAD_CHINK_SIZE = 5000;

    let engine: Engine | undefined;

    async function startEngine(configuration: Configuration): Promise<void> {
        const { filters, userrules, verbose } = configuration;

        const lists: StringRuleList[] = [];

        for (let i = 0; i < filters.length; i += 1) {
            const { filterId, content } = filters[i];
            lists.push(new StringRuleList(filterId, content));
        }

        if (userrules.length > 0) {
            lists.push(new StringRuleList(0, userrules.join('\n')));
        }

        const ruleStorage = new RuleStorage(lists);

        setConfiguration({
            engine: 'extension',
            version: '1.0.0',
            verbose,
            compatibility: CompatibilityTypes.extension,
        });

        /*
         * UI thread becomes blocked on the options page while request filter is created
         * that's why we create filter rules using chunks of the specified length
         * Request filter creation is rather slow operation so we should
         * use setTimeout calls to give UI thread some time.
        */
        engine = new Engine(ruleStorage, true);

        await engine.loadRulesAsync(ASYNC_LOAD_CHINK_SIZE);
    }

    function matchRequest(matchQuery: MatchQuery): MatchingResult | null {
        if (!engine) {
            return null;
        }

        const {
            requestUrl,
            frameUrl,
            requestType,
        } = matchQuery;

        let { frameRule } = matchQuery;

        const request = new Request(
            requestUrl,
            frameUrl,
            requestType,
        );

        if (!frameRule) {
            frameRule = null;
        }

        return engine.matchRequest(request, frameRule);
    }

    function matchFrame(frameUrl: string): NetworkRule | null {
        if (!engine){
            return null;
        }

        return engine.matchFrame(frameUrl);
    }

    
    function getCosmeticResult(url: string, option: CosmeticOption): CosmeticResult {
        if (!engine) {
            return new CosmeticResult();
        }

        const frameUrl = getHost(url);
        const request = new Request(url, frameUrl, RequestType.Document);

        return engine.getCosmeticResult(request, option);
    }

    function getRulesCount(): number{
        return engine ? engine.getRulesCount() : 0;
    }

    return {
        startEngine,
        matchRequest,
        matchFrame,
        getCosmeticResult,
        getRulesCount,
    };
})();
