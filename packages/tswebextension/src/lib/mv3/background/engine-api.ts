import {
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
    type EngineFilterList,
} from '@adguard/tsurlfilter';
import browser from 'webextension-polyfill';
import { type IFilter } from '@adguard/tsurlfilter/es/declarative-converter';

import { ALLOWLIST_FILTER_ID, QUICK_FIXES_FILTER_ID, USER_FILTER_ID } from '../../common/constants';
import { getErrorMessage } from '../../common/error';
import { logger } from '../../common/utils/logger';
import { isHttpOrWsRequest, isHttpRequest, getHost } from '../../common/utils/url';

import { allowlistApi } from './allowlist-api';
import { type ConfigurationMV3 } from './configuration';
import { DocumentApi } from './document-api';

const ASYNC_LOAD_CHINK_SIZE = 5000;

type EngineConfig = Pick<ConfigurationMV3, 'userrules' | 'quickFixesRules' | 'verbose'> & {
    filters: IFilter[],
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
     * Starts the engine with the provided bunch of rules,
     * wrapped in filters or custom rules.
     *
     * @param config {@link EngineConfig} Which contains filters (static and
     * custom), custom rules, quick fixes rules and the verbose flag.
     */
    async startEngine(config: EngineConfig): Promise<void> {
        const {
            filters,
            userrules,
            quickFixesRules,
            verbose,
        } = config;

        const lists: EngineFilterList[] = [];

        for (let i = 0; i < filters.length; i += 1) {
            try {
                const filter = filters[i];
                // eslint-disable-next-line no-await-in-loop
                const content = await filter.getContent();
                const trusted = filter.isTrusted();

                lists.push({
                    id: filter.getId(),
                    text: content,
                    ignoreCosmetic: false,
                    ignoreJS: !trusted,
                    ignoreUnsafe: !trusted,
                });
            } catch (e) {
                const filterId = filters[i].getId();
                logger.error(`Cannot create IRuleList for filter ${filterId} due to: ${getErrorMessage(e)}`);
            }
        }

        if (userrules.length > 0) {
            // Note: rules are already converted at the extension side
            lists.push({
                id: USER_FILTER_ID,
                text: userrules,
                ignoreCosmetic: false,
                ignoreJS: false,
                ignoreUnsafe: false,
            });
        }

        if (quickFixesRules.length > 0) {
            // Note: rules are already converted at the extension side
            lists.push({
                id: QUICK_FIXES_FILTER_ID,
                text: quickFixesRules,
                ignoreCosmetic: false,
                ignoreJS: false,
                ignoreUnsafe: false,
            });
        }

        const allowlistRulesList = allowlistApi.getAllowlistRules();
        if (allowlistRulesList) {
            lists.push({
                id: ALLOWLIST_FILTER_ID,
                text: allowlistRulesList,
                ignoreCosmetic: false,
                ignoreJS: false,
                ignoreUnsafe: false,
            });
        }

        /*
         * UI thread becomes blocked on the options page while request filter is
         * created that's why we create filter rules using chunks of
         * the specified length.
         * Request filter creation is rather slow operation so we should
         * use setTimeout calls to give UI thread some time.
        */
        const engine = new Engine({
            filters: lists,
            skipInitialScan: true,
        });
        await engine.loadRulesAsync(ASYNC_LOAD_CHINK_SIZE);
        this.engine = engine;

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

        // Checks if an allowlist rule exists at the document level,
        // then discards all cosmetic rules.
        const allowlistFrameRule = DocumentApi.matchFrame(url);
        if (allowlistFrameRule) {
            return new CosmeticResult();
        }

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
}

export const engineApi = new EngineApi();
