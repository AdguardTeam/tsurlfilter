import browser from 'webextension-polyfill';
import {
    type IRuleList,
    BufferRuleList,
    RuleStorage,
    Engine,
    setConfiguration,
    CompatibilityTypes,
    RequestType,
    type NetworkRule,
    type MatchingResult,
    Request,
    CosmeticResult,
    type CosmeticOption,
} from '@adguard/tsurlfilter';
import { type AnyRule } from '@adguard/agtree';

import { USER_FILTER_ID } from '../../common/constants';
import { getHost, isHttpRequest } from '../../common/utils/url';
import { type MatchQuery } from '../../common/interfaces';

import { type Allowlist } from './allowlist';
import { type StealthApi } from './stealth-api';
import { type ConfigurationMV2 } from './configuration';
import { type AppContext } from './app-context';

/**
 * TSUrlFilter Engine wrapper.
 */
export class EngineApi {
    private static readonly ASYNC_LOAD_CHINK_SIZE = 5000;

    private engine: Engine | undefined;

    /**
     * Gets app filtering status.
     *
     * @returns True if filtering is enabled, otherwise returns false.
     */
    public get isFilteringEnabled(): boolean {
        // TODO: Remove this check after moving call of storage initialization in extension code.
        // Check this flag before access storage values, because engine methods
        // can by triggered before initialization by content script requests.
        if (!this.appContext.isStorageInitialized) {
            return false;
        }

        return Boolean(this.appContext.configuration?.settings.filteringEnabled);
    }

    /**
     * Creates Engine Api instance.
     *
     * @param allowlist Allowlist.
     * @param appContext App context.
     * @param stealthApi Stealth Api.
     */
    constructor(
        private readonly allowlist: Allowlist,
        private readonly appContext: AppContext,
        private readonly stealthApi: StealthApi,
    ) { }

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

        this.allowlist.configure(configuration);

        const lists: IRuleList[] = [];

        for (let i = 0; i < filters.length; i += 1) {
            const {
                filterId,
                content,
                trusted,
                sourceMap,
            } = filters[i];

            lists.push(
                new BufferRuleList(
                    filterId,
                    content,
                    false,
                    !trusted,
                    !trusted,
                    sourceMap,
                ),
            );
        }

        if (userrules.content.length > 0) {
            lists.push(
                new BufferRuleList(
                    USER_FILTER_ID,
                    userrules.content,
                    false,
                    false,
                    false,
                    userrules.sourceMap,
                ),
            );
        }
        const allowlistRulesList = this.allowlist.getAllowlistRules();
        if (allowlistRulesList) {
            lists.push(allowlistRulesList);
        }

        const stealthModeList = this.stealthApi.getStealthModeRuleList();
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

        await engine.loadRulesAsync(EngineApi.ASYNC_LOAD_CHINK_SIZE);

        this.engine = engine;
    }

    /**
     * Searched for rules by match query.
     *
     * @param matchQuery Query against which the request would be matched.
     *
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
            method,
        } = matchQuery;

        let { frameRule } = matchQuery;

        const request = new Request(
            requestUrl,
            frameUrl,
            requestType,
            method,
        );

        if (!frameRule) {
            frameRule = null;
        }

        return this.engine.matchRequest(request, frameRule);
    }

    /**
     * Searched for cosmetic rules by match query.
     *
     * @param matchQuery Query against which the request would be matched.
     *
     * @returns Cosmetic result.
     */
    public matchCosmetic(matchQuery: MatchQuery): CosmeticResult {
        if (!this.engine || !this.isFilteringEnabled || !isHttpRequest(matchQuery.frameUrl)) {
            return new CosmeticResult();
        }

        const matchingResult = this.matchRequest(matchQuery);

        if (!matchingResult) {
            return new CosmeticResult();
        }

        const cosmeticOption = matchingResult.getCosmeticOption();

        return this.getCosmeticResult(matchQuery.requestUrl, cosmeticOption);
    }

    /**
     * Matches current frame url and returns rule if found.
     *
     * @param frameUrl Frame url.
     *
     * @returns NetworkRule or null.
     */
    public matchFrame(frameUrl: string): NetworkRule | null {
        if (!this.engine || !this.isFilteringEnabled || !isHttpRequest(frameUrl)) {
            return null;
        }

        return this.engine.matchFrame(frameUrl);
    }

    /**
     * Gets cosmetic result for the specified hostname and cosmetic options.
     *
     * @param url Request url.
     * @param option Cosmetic options.
     *
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
        if (!this.engine) {
            return null;
        }

        return this.engine.retrieveRuleNode(filterId, ruleIndex);
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
