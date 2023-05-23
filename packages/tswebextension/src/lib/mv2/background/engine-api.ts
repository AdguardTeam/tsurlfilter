/* eslint-disable class-methods-use-this */
import browser from 'webextension-polyfill';
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
    CosmeticOption,
    RuleConverter,
} from '@adguard/tsurlfilter';

import { getHost } from '../../common';
import { allowlistApi } from './allowlist';
import { stealthApi } from './stealth-api';
import { ConfigurationMV2 } from './configuration';
import { appContext } from './context';
import { documentBlockingService } from './services/document-blocking-service';
import { USER_FILTER_ID } from '../../common/constants';

/**
 * Request Match Query.
 */
export interface MatchQuery {
    requestUrl: string;
    frameUrl: string;
    requestType: RequestType;
    frameRule?: NetworkRule | null;
}

export interface EngineApiInterface {
    startEngine: (configuration: ConfigurationMV2) => Promise<void>;

    /**
     * Gets matching result for request.
     */
    matchRequest: (matchQuery: MatchQuery) => MatchingResult | null;

    /**
     * Matches current frame url and returns document-level rule if found.
     */
    matchFrame: (frameUrl: string) => NetworkRule | null;

    /**
     * Gets cosmetic result for the specified hostname and cosmetic options.
     */
    getCosmeticResult: (url: string, option: CosmeticOption) => CosmeticResult;

    getRulesCount: () => number;
}

const ASYNC_LOAD_CHINK_SIZE = 5000;

/**
 * TSUrlFilter Engine wrapper.
 */
export class EngineApi implements EngineApiInterface {
    private engine: Engine | undefined;

    /**
     * Gets app filtering status.
     *
     * @returns True if filtering is enabled, otherwise returns false.
     */
    public get isFilteringEnabled(): boolean {
        return Boolean(appContext.configuration?.settings.filteringEnabled);
    }

    /**
     * Starts engine.
     *
     * @param configuration Engine configuration.
     */
    public async startEngine(configuration: ConfigurationMV2): Promise<void> {
        const {
            filters,
            userrules,
            verbose,
        } = configuration;

        allowlistApi.configure(configuration);

        documentBlockingService.configure(configuration);

        const lists: StringRuleList[] = [];

        for (let i = 0; i < filters.length; i += 1) {
            const { filterId, content, trusted } = filters[i];
            const convertedContent = RuleConverter.convertRules(content);
            lists.push(new StringRuleList(
                filterId,
                convertedContent,
                false,
                !trusted,
                !trusted,
            ));
        }

        if (userrules.length > 0) {
            const convertedUserRules = RuleConverter.convertRules(userrules.join('\n'));
            lists.push(new StringRuleList(USER_FILTER_ID, convertedUserRules));
        }

        const allowlistRules = allowlistApi.getAllowlistRules();
        if (allowlistRules) {
            lists.push(allowlistRules);
        }

        const stealthModeList = stealthApi.getStealthModeRuleList();
        if (stealthModeList) {
            lists.push(stealthModeList);
        }

        const ruleStorage = new RuleStorage(lists);

        setConfiguration({
            engine: 'extension',
            version: browser.runtime.getManifest().version,
            verbose,
            compatibility: CompatibilityTypes.Extension,
        });

        /*
         * UI thread becomes blocked on the options page while request filter is created
         * that's why we create filter rules using chunks of the specified length
         * Request filter creation is rather slow operation so we should
         * use setTimeout calls to give UI thread some time.
        */
        const engine = new Engine(ruleStorage, true);

        await engine.loadRulesAsync(ASYNC_LOAD_CHINK_SIZE);

        this.engine = engine;
    }

    /**
     * Searched for rules by match query.
     *
     * @param matchQuery Query against which the request would be matched.
     * @returns Matching result or null.
     */
    public matchRequest(matchQuery: MatchQuery): MatchingResult | null {
        if (!this.engine || !this.isFilteringEnabled) {
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

    /**
     * Matches current frame url and returns rule if found.
     *
     * @param frameUrl Frame url.
     * @returns NetworkRule or null.
     */
    public matchFrame(frameUrl: string): NetworkRule | null {
        if (!this.engine || !this.isFilteringEnabled) {
            return null;
        }

        return this.engine.matchFrame(frameUrl);
    }

    /**
     * Gets cosmetic result for the specified hostname and cosmetic options.
     *
     * @param url Request url.
     * @param option Cosmetic options.
     * @returns Cosmetic result.
     */
    public getCosmeticResult(url: string, option: CosmeticOption): CosmeticResult {
        if (!this.engine || !this.isFilteringEnabled) {
            return new CosmeticResult();
        }

        const frameUrl = getHost(url);
        const request = new Request(url, frameUrl, RequestType.Document);

        return this.engine.getCosmeticResult(request, option);
    }

    /**
     * Simple getter for rules count.
     *
     * @returns Number of rules in the engine.
     */
    public getRulesCount(): number {
        return this.engine ? this.engine.getRulesCount() : 0;
    }
}

export const engineApi = new EngineApi();
