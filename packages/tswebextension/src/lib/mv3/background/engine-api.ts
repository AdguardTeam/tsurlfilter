// TODO: Remove call to console
/* eslint-disable no-console */

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
} from '@adguard/tsurlfilter';

import { Configuration } from '../../common';
import { getHost } from '../../common/utils';
import { CosmeticApi } from './cosmetic-api';

const ASYNC_LOAD_CHINK_SIZE = 5000;
const USER_FILTER_ID = 0;

type FilterConfig = Pick<Configuration, 'filters' | 'userrules' | 'verbose'>;

/**
 * TSUrlFilter Engine wrapper
 */
class EngineApi {
    private engine: Engine | undefined;

    waitingForEngine: Promise<void> | undefined;

    /**
     * Starts engine with provided config
     * @param config config for pass to engine
     */
    async startEngine(config: FilterConfig): Promise<void> {
        const { filters, userrules, verbose } = config;

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

        const ruleStorage = new RuleStorage(lists);

        setConfiguration({
            engine: 'extension',
            version: chrome.runtime.getManifest().version,
            verbose,
            compatibility: CompatibilityTypes.extension,
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
     * Stops filtering engine
     */
    async stopEngine() {
        this.engine = undefined;
    }

    /**
     * Gets cosmetic result for the specified url and cosmetic options if engine is started
     * Otherwise returns empty CosmeticResult
     *
     * @param url hostname to check
     * @param option mask of enabled cosmetic types
     * @return cosmetic result
     */
    private getCosmeticResult(url: string, option: CosmeticOption): CosmeticResult {
        if (!this.engine) {
            return new CosmeticResult();
        }

        const frameUrl = getHost(url);
        const request = new Request(url, frameUrl, RequestType.Document);

        return this.engine.getCosmeticResult(request, option);
    }

    /**
     * Builds CSS for the specified web page.
     * http://adguard.com/en/filterrules.html#hideRules
     *
     * @param {string} url Page URL
     * @param {number} options bitmask
     * @param {boolean} ignoreTraditionalCss flag
     * @param {boolean} ignoreExtCss flag
     * @returns {*} CSS and ExtCss data for the webpage
     */
    buildCosmeticCss(
        url: string,
        options: CosmeticOption,
        ignoreTraditionalCss: boolean,
        ignoreExtCss: boolean,
    ) {
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

        console.debug('[BUILD COSMETIC CSS]: builded');

        return {
            css: styles,
            extendedCss: extStyles,
        };
    }

    /**
     * Builds domain-specific JS injection for the specified page.
     * http://adguard.com/en/filterrules.html#javascriptInjection
     *
     * @param url
     * @param option
     * @returns Javascript for the specified URL
     */
    getScriptsForUrl = (url: string, option: CosmeticOption) => {
        const cosmeticResult = this.getCosmeticResult(url, option);

        return cosmeticResult.getScriptRules();
    };

    /**
     * Returns scriptlets data by url
     * @param url
     * @param option
     */
    getScriptletsDataForUrl(url: string, option: CosmeticOption) {
        const scriptRules = this.getScriptsForUrl(url, option);
        const scriptletDataList = scriptRules
            .filter((rule) => rule.isScriptlet)
            .map((scriptletRule) => scriptletRule.getScriptletData());
        return scriptletDataList;
    }

    /**
     * Builds the final output string for the specified page.
     * Depending on the browser we either allow or forbid the new remote rules
     * grep "localScriptRulesService" for details about script source
     *
     * @param url
     * @param option
     * @returns Script to be applied
     */
    getScriptsStringForUrl(url: string, option: CosmeticOption) {
        const scriptRules = this.getScriptsForUrl(url, option);

        // scriptlet rules would are handled separately
        const scripts = scriptRules
            .filter((rule) => !rule.isScriptlet)
            .map((scriptRule) => scriptRule.getScript());
        // remove repeating scripts
        const scriptsCode = [...new Set(scripts)].join('\r\n');

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
