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


export interface EngineApiInterface {
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


const ASYNC_LOAD_CHINK_SIZE = 5000;

/**
 * TSUrlFilter Engine wrapper
 */
export class EngineApi implements EngineApiInterface {
    private engine: Engine | undefined;

    public async startEngine(configuration: Configuration): Promise<void> {
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
        this.engine = new Engine(ruleStorage, true);

        await this.engine.loadRulesAsync(ASYNC_LOAD_CHINK_SIZE);
    }

    public matchRequest(matchQuery: MatchQuery): MatchingResult | null {
        if (!this.engine) {
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

        return this.engine.matchRequest(request, frameRule);
    }

    public matchFrame(frameUrl: string): NetworkRule | null {
        if(!this.engine){
            return null;
        }

        return this.engine.matchFrame(frameUrl)
    }

    
     public getCosmeticResult(url: string, option: CosmeticOption): CosmeticResult {
        if (!this.engine) {
            return new CosmeticResult();
        }

        const frameUrl = getHost(url);
        const request = new Request(url, frameUrl, RequestType.Document);

        return this.engine.getCosmeticResult(request, option);
    };

    public getRulesCount(): number{
        return this.engine ? this.engine.getRulesCount() : 0;
    }
}

export const engineApi = new EngineApi();
