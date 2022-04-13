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

    /**
     * Starts engine with provided config
     * @param config config for pass to engine
     */
    async startEngine(config: FilterConfig): Promise<void> {
        console.debug('[START ENGINE]: start');

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
        this.engine = new Engine(ruleStorage, true);

        await this.engine.loadRulesAsync(ASYNC_LOAD_CHINK_SIZE);

        console.debug('[START ENGINE]: end');
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
        console.debug('[BUILD COSMETIC CSS]: start');
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
}

export const engineApi = new EngineApi();
