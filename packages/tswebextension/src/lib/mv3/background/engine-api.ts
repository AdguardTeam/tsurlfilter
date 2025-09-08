import {
    type IRuleList,
    BufferRuleList,
    RuleStorage,
    Engine,
    RequestType,
    Request,
    CosmeticResult,
    type CosmeticOption,
    type NetworkRule,
    type MatchingResult,
    type HTTPMethod,
    setConfiguration,
    CompatibilityTypes,
} from '@adguard/tsurlfilter';
import browser from 'webextension-polyfill';
import { UnavailableFilterSourceError, type IFilter } from '@adguard/tsurlfilter/es/declarative-converter';
import { type AnyRule } from '@adguard/agtree';

import { QUICK_FIXES_FILTER_ID, USER_FILTER_ID } from '../../common/constants';
import { logger } from '../../common/utils/logger';
import { isHttpOrWsRequest, isHttpRequest, getHost } from '../../common/utils/url';

import { type ConfigurationMV3 } from './configuration';
import { UserScriptsApi } from './user-scripts-api';

const ASYNC_LOAD_CHINK_SIZE = 5000;

type EngineConfig = Pick<ConfigurationMV3, 'quickFixesRules' | 'verbose'> & {
    /**
     * For filters which bundled with extension.
     */
    localFilters: IFilter[];

    /**
     * For filters which are downloaded by user from remote sources, e.g.
     * custom filters.
     */
    remoteFilters: IFilter[];

    /**
     * Filter with user-defined rules.
     */
    userRulesFilter: IFilter;

    /**
     * Allowlist rules, user-defined.
     */
    allowlistRulesList: IRuleList | null;
};

/**
 * Request Match Query, contains request details.
 */
interface MatchQuery {
    requestUrl: string;
    frameUrl: string;
    requestType: RequestType;
    frameRule?: NetworkRule | null;
    method?: HTTPMethod;
}

/**
 * EngineApi - TSUrlFilter engine wrapper which controls how to work with
 * cosmetic rules.
 */
export class EngineApi {
    /**
     * Link to current Engine.
     */
    private engine: Engine | undefined;

    // TODO: Make private
    /**
     * To prevent multiple calls to startEngine, saves the first call to
     * startEngine and waits for it.
     */
    waitingForEngine: Promise<void> | undefined;

    /**
     * List of filter ids for local rules.
     * It is used to split local and remote rules.
     */
    private localRulesFiltersIds: number[] = [];

    /**
     * Id of user rules filter.
     * It is used to split local and remote rules.
     */
    private userFilterId: number = USER_FILTER_ID;

    /**
     * Starts the engine with the provided bunch of rules,
     * wrapped in filters or custom rules.
     *
     * @param config {@link EngineConfig} Which contains filters (static and
     * custom), custom rules, quick fixes rules and the verbose flag.
     */
    async startEngine(config: EngineConfig): Promise<void> {
        const {
            localFilters,
            remoteFilters,
            userRulesFilter,
            allowlistRulesList,
            quickFixesRules,
            verbose,
        } = config;

        const lists: IRuleList[] = [];

        /**
         * If userScripts permission is not granted, custom filters are
         * not allowed to be executed, because they are from remote source.
         * Rules from built-in filters are always applied.
         */
        const filters = UserScriptsApi.isEnabled
            ? localFilters.concat(remoteFilters)
            : localFilters;

        for (let i = 0; i < filters.length; i += 1) {
            try {
                const filter = filters[i];
                // eslint-disable-next-line no-await-in-loop
                const content = await filter.getContent();
                const trusted = filter.isTrusted();

                lists.push(
                    new BufferRuleList(
                        filter.getId(),
                        content.filterList,
                        false,
                        !trusted,
                        !trusted,
                        content.sourceMap,
                    ),
                );
            } catch (e) {
                const filterId = filters[i].getId();
                logger.error(`[tsweb.EngineApi.startEngine]: cannot create IRuleList for filter ${filterId} due to: `, e);
            }
        }

        /**
         * Only rules from built-in filters are allowed to be executed
         * from user rules.
         *
         * @see CosmeticFrameProcessor.splitLocalRemoteScriptRules
         */
        try {
            const userrules = await userRulesFilter.getContent();
            if (userrules.filterList.length > 0) {
                // Note: rules are already converted at the extension side
                lists.push(
                    new BufferRuleList(
                        USER_FILTER_ID,
                        userrules.filterList,
                        false,
                        false,
                        false,
                        userrules.sourceMap,
                    ),
                );
            }
        } catch (e) {
            const filterId = userRulesFilter.getId();

            // This dirty hack is needed since Filter check inside itself
            // for empty loaded content.
            if (e instanceof UnavailableFilterSourceError
                && e.cause instanceof Error
                && e.cause.message.includes('Loaded empty content')) {
                // User rules can be empty, so just log a trace message and continue.
                logger.trace(`[tsweb.EngineApi.startEngine]: user rules filter ${filterId} is empty: `, e);
            } else {
                logger.error(`[tsweb.EngineApi.startEngine]: cannot create IRuleList for user rules filter ${filterId} due to: `, e);
            }
        }

        if (quickFixesRules.filterList.length > 0) {
            // Note: rules are already converted at the extension side
            lists.push(
                new BufferRuleList(
                    QUICK_FIXES_FILTER_ID,
                    quickFixesRules.filterList,
                    false,
                    false,
                    false,
                    quickFixesRules.sourceMap,
                ),
            );
        }

        if (allowlistRulesList) {
            lists.push(allowlistRulesList);
        }

        const ruleStorage = new RuleStorage(lists);

        /*
         * UI thread becomes blocked on the options page while request filter is
         * created that's why we create filter rules using chunks of
         * the specified length.
         * Request filter creation is rather slow operation so we should
         * use setTimeout calls to give UI thread some time.
        */
        const engine = new Engine(ruleStorage, true);
        await engine.loadRulesAsync(ASYNC_LOAD_CHINK_SIZE);
        this.engine = engine;

        // Update IDs of loaded to engine filters for split local and remote
        // scripts.
        this.localRulesFiltersIds = localFilters.map((filter) => filter.getId());
        this.userFilterId = userRulesFilter.getId();

        // Update configuration of engine.
        setConfiguration({
            engine: 'extension',
            version: browser.runtime.getManifest().version,
            verbose,
            compatibility: CompatibilityTypes.Extension,
        });
    }

    /**
     * Stops filtering engine with cosmetic rules.
     */
    public stopEngine(): void {
        this.engine = undefined;
    }

    /**
     * Matches current frame and returns document-level allowlist rule if found.
     *
     * @param frameUrl Url of current frame.
     *
     * @returns Document-level allowlist rule if found, otherwise null.
     */
    public matchFrame(frameUrl: string): NetworkRule | null {
        if (!this.engine || !isHttpOrWsRequest(frameUrl)) {
            return null;
        }

        return this.engine.matchFrame(frameUrl);
    }

    /**
     * Gets cosmetic result for the specified url and cosmetic options if
     * engine is started.
     * Otherwise returns empty CosmeticResult.
     *
     * @param url Hostname to check.
     * @param option Mask of enabled cosmetic types.
     *
     * @returns Cosmetic result.
     */
    public getCosmeticResult(url: string, option: CosmeticOption): CosmeticResult {
        if (!this.engine) {
            return new CosmeticResult();
        }

        const frameUrl = getHost(url);

        const request = new Request(url, frameUrl, RequestType.Document);

        return this.engine.getCosmeticResult(request, option);
    }

    /**
     * Gets current loaded rules in the filtering engine
     * (except declarative rules).
     *
     * @returns Number of loaded rules in the filtering engine.
     */
    public getRulesCount(): number {
        return this.engine ? this.engine.getRulesCount() : 0;
    }

    /**
     * Searched for cosmetic rules by match query.
     *
     * @param matchQuery Query against which the request would be matched.
     *
     * @returns Cosmetic result.
     */
    public matchCosmetic(matchQuery: MatchQuery): CosmeticResult {
        if (!this.engine || !isHttpRequest(matchQuery.frameUrl)) {
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
     * Matches the specified request against the filtering engine and returns the matching result.
     *
     * @param matchQuery Item of {@link MatchQuery}, contains request details.
     *
     * @returns Item of {@link MatchingResult} or null, if engine is not started.
     */
    public matchRequest(matchQuery: MatchQuery): MatchingResult | null {
        if (!this.engine) {
            return null;
        }

        const {
            requestUrl,
            frameUrl,
            requestType,
            frameRule,
        } = matchQuery;

        const request = new Request(
            requestUrl,
            frameUrl,
            requestType,
        );

        return this.engine.matchRequest(request, frameRule);
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
     * Checks if the filter with the specified id is local (built-in).
     *
     * @param filterId Filter id to check.
     *
     * @returns `true` if the filter is local, `false` otherwise.
     */
    public isLocalFilter(filterId: number): boolean {
        return this.localRulesFiltersIds.includes(filterId);
    }

    /**
     * Checks if the filter with the specified id is defined by user,
     * i.e. User rules.
     *
     * @param filterId Filter id to check.
     *
     * @returns `true` if the filter is defined by user, `false` otherwise.
     */
    public isUserRulesFilter(filterId: number): boolean {
        return filterId === this.userFilterId;
    }
}

export const engineApi = new EngineApi();
