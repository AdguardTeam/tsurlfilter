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
    RuleConverter
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

const ALLOWLIST_FILTER_ID = 100;

const USER_FILTER_ID = 0;

/**
 * TSUrlFilter Engine wrapper
 */
export class EngineApi implements EngineApiInterface {
    private engine: Engine | undefined;

    public async startEngine(configuration: Configuration): Promise<void> {
        const { filters, userrules, allowlist, verbose, settings } = configuration;

        const lists: StringRuleList[] = [];

        for (let i = 0; i < filters.length; i += 1) {
            const { filterId, content } = filters[i];
            const convertedContent = RuleConverter.convertRules(content);
            lists.push(new StringRuleList(filterId, convertedContent));
        }

        if (userrules.length > 0) {
            const convertedUserRules = RuleConverter.convertRules(userrules.join('\n'));
            lists.push(new StringRuleList(USER_FILTER_ID, convertedUserRules));
        }

        if (allowlist.length > 0){
            lists.push(new StringRuleList(
                ALLOWLIST_FILTER_ID, 
                allowlist.map((domain) => {
                    return (settings.allowlistInverted ? '' : '@@') + `//${domain}$document`;
                }).join('\n')),
            );
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
        if (!this.engine){
            return null;
        }

        return this.engine.matchFrame(frameUrl);
    }


    public getCosmeticResult(url: string, option: CosmeticOption): CosmeticResult {
        if (!this.engine) {
            return new CosmeticResult();
        }

        const frameUrl = getHost(url);
        const request = new Request(url, frameUrl, RequestType.Document);

        return this.engine.getCosmeticResult(request, option);
    }

    public getRulesCount(): number{
        return this.engine ? this.engine.getRulesCount() : 0;
    }
}

export const engineApi = new EngineApi();
