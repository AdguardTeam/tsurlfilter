import {
    StringRuleList,
    RuleStorage,
    Engine,
    setConfiguration,
    CompatibilityTypes,
    RequestType,
    Request,
    CosmeticResult,
    CosmeticOption,
    RuleConverter,
    ScriptletData,
    CosmeticRule,
    NetworkRule,
    MatchingResult,
} from '@adguard/tsurlfilter';

import { IFilter } from '@adguard/tsurlfilter/es/declarative-converter';

import { getHost } from '../../common/utils';
import { getErrorMessage } from '../../common/error';
import { logger } from '../utils/logger';

import { ConfigurationMV3 } from './configuration';
import { CosmeticApi } from './cosmetic-api';

const ASYNC_LOAD_CHINK_SIZE = 5000;
const USER_FILTER_ID = 0;

type EngineConfig = Pick<ConfigurationMV3, 'userrules' | 'verbose'> & {
    filters: IFilter[],
};

/**
 * Request Match Query, contains request details.
 */
interface MatchQuery {
    requestUrl: string;
    sourceUrl: string;
    requestType: RequestType;
    frameRule?: NetworkRule | null;
}

export type CosmeticRules = {
    css: string[],
    extendedCss: string[],
};

/**
 * EngineApi - TSUrlFilter engine wrapper which controls how to work with
 * cosmetic rules.
 */
class EngineApi {
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
     * custom), custom rules and the verbose flag.
     */
    async startEngine(config: EngineConfig): Promise<void> {
        const {
            filters, userrules, verbose,
        } = config;

        const lists: StringRuleList[] = [];

        // Wrap IFilter to StringRuleList
        const tasks = filters.map(async (filter) => {
            const content = await filter.getContent();
            // TODO: Maybe pass filters content via FilterList to exclude double conversion
            const convertedContent = RuleConverter.convertRules(content.join('\n'));
            lists.push(new StringRuleList(filter.getId(), convertedContent));
        });

        try {
            await Promise.all(tasks);
        } catch (e) {
            const filterListIds = filters.map((f) => f.getId());

            // eslint-disable-next-line max-len
            logger.error(`Cannot create StringRuleList for list of filters ${filterListIds} due to: ${getErrorMessage(e)}`);

            // Do not return value here because we can try to convert at least user rules.
        }

        // Wrap user rules to StringRuleList
        if (userrules.length > 0) {
            const convertedUserRules = RuleConverter.convertRules(userrules.join('\n'));
            lists.push(new StringRuleList(USER_FILTER_ID, convertedUserRules));
        }

        const ruleStorage = new RuleStorage(lists);

        setConfiguration({
            engine: 'extension',
            version: chrome.runtime.getManifest().version,
            verbose,
            compatibility: CompatibilityTypes.Extension,
        });

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
    }

    /**
     * Stops filtering engine with cosmetic rules.
     */
    public async stopEngine(): Promise<void> {
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
        if (!this.engine) {
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
     * @returns Cosmetic result.
     */
    private getCosmeticResult(url: string, option: CosmeticOption): CosmeticResult {
        if (!this.engine) {
            return new CosmeticResult();
        }

        const frameUrl = getHost(url);

        // Checks if an allowlist rule exists at the document level,
        // then discards all cosmetic rules.
        const frameRule = this.engine.matchFrame(url);
        if (frameRule?.isAllowlist()) {
            return new CosmeticResult();
        }

        const request = new Request(url, frameUrl, RequestType.Document);

        return this.engine.getCosmeticResult(request, option);
    }

    /**
     * Builds CSS for the specified web page.
     *
     * @see http://adguard.com/en/filterrules.html#hideRules
     *
     * @param url Page URL.
     * @param options Bitmask.
     * @param ignoreTraditionalCss Flag.
     * @param ignoreExtCss Flag.
     *
     * @returns CSS and ExtCss data for the webpage.
     */
    public buildCosmeticCss(
        url: string,
        options: CosmeticOption,
        ignoreTraditionalCss: boolean,
        ignoreExtCss: boolean,
    ): CosmeticRules {
        const cosmeticResult = this.getCosmeticResult(url, options);

        const elemhideCss = [
            ...cosmeticResult.elementHiding.generic,
            ...cosmeticResult.elementHiding.specific,
        ];
        const injectCss = [
            ...cosmeticResult.CSS.generic,
            ...cosmeticResult.CSS.specific,
        ];

        const elemhideExtCss = [
            ...cosmeticResult.elementHiding.genericExtCss,
            ...cosmeticResult.elementHiding.specificExtCss,
        ];
        const injectExtCss = [
            ...cosmeticResult.CSS.genericExtCss,
            ...cosmeticResult.CSS.specificExtCss,
        ];

        const styles = !ignoreTraditionalCss
            ? CosmeticApi.buildStyleSheet(elemhideCss, injectCss, true)
            : [];
        const extStyles = !ignoreExtCss
            ? CosmeticApi.buildStyleSheet(elemhideExtCss, injectExtCss, false)
            : [];

        logger.debug('[BUILD COSMETIC CSS]: builded');

        return {
            css: styles,
            extendedCss: extStyles,
        };
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
     * Builds domain-specific JS injection for the specified page.
     *
     * @see http://adguard.com/en/filterrules.html#javascriptInjection
     *
     * @param url Page URL.
     * @param option Bitmask.
     *
     * @returns Javascript for the specified URL.
     */
    public getScriptsForUrl = (url: string, option: CosmeticOption): CosmeticRule[] => {
        const cosmeticResult = this.getCosmeticResult(url, option);

        return cosmeticResult.getScriptRules();
    };

    /**
     * Returns scriptlets data by url.
     *
     * @param url Page URL.
     * @param option Bitmask.
     *
     * @returns List of {@link ScriptletData}.
     */
    public getScriptletsDataForUrl(url: string, option: CosmeticOption): ScriptletData[] {
        const scriptRules = this.getScriptsForUrl(url, option);
        const scriptletDataList: ScriptletData[] = [];
        scriptRules.forEach((scriptRule) => {
            if (!scriptRule.isScriptlet) {
                return;
            }

            const scriptletData = scriptRule.getScriptletData();
            if (!scriptletData) {
                return;
            }

            scriptletDataList.push(scriptletData);
        });

        return scriptletDataList;
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
            sourceUrl,
            requestType,
            frameRule,
        } = matchQuery;

        const request = new Request(
            requestUrl,
            sourceUrl,
            requestType,
        );

        return this.engine.matchRequest(request, frameRule);
    }

    /**
     * Builds the final output string for the specified page.
     * Depending on the browser we either allow or forbid the new remote rules
     * grep "localScriptRulesService" for details about script source.
     *
     * @param url Page URL.
     * @param option Bitmask.
     *
     * @returns Script to be applied.
     */
    public getScriptsStringForUrl(url: string, option: CosmeticOption): string {
        const scriptRules = this.getScriptsForUrl(url, option);

        // TODO: Add check for firefox AMO

        // scriptlet rules would are handled separately
        const scripts = scriptRules
            .filter((rule) => !rule.isScriptlet)
            .map((scriptRule) => scriptRule.getScript());
        // remove repeating scripts
        const scriptsCode = [...new Set(scripts)].join('\r\n');

        // TODO: Check call to filtering log

        return `
                (function () {
                    try {
                        ${scriptsCode}
                    } catch (ex) {
                        console.error('Error executing AG js: ' + ex);
                    }
                })();
            `;
    }
}

export const engineApi = new EngineApi();
