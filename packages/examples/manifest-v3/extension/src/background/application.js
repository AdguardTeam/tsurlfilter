/* eslint-disable no-console, import/extensions, import/no-unresolved */
// eslint-disable-next-line import/no-extraneous-dependencies
import * as TSUrlFilter from '@adguard/tsurlfilter';
import { applyCss, applyScripts } from './cosmetic.js';

/**
 * Extension application class
 */
export class Application {
    /**
     * TS Engine instance
     */
    engine;

    // eslint-disable-next-line no-undef
    browser = chrome;

    /**
     * Dynamic rule list
     */
    dynamicList;

    /**
     * Chrome dynamic rules list id
     */
    DYNAMIC_LIST_ID = '_dynamic';

    /**
     * Initializes engine instance
     *
     * @param rulesText
     */
    async startEngine(rulesText) {
        console.log('Starting url filter engine');

        const config = {
            engine: 'extension',
            // eslint-disable-next-line no-undef
            version: chrome.runtime.getManifest().version,
            verbose: true,
            compatibility: TSUrlFilter.CompatibilityTypes.extension,
        };

        TSUrlFilter.setConfiguration(config);

        this.dynamicList = new TSUrlFilter.StringRuleList(1, rulesText, false);

        const ruleStorage = new TSUrlFilter.RuleStorage([this.dynamicList]);
        this.engine = new TSUrlFilter.Engine(ruleStorage);

        console.log('Starting url filter engine..ok');

        this.updateDynamicDeclarativeRules();
    }

    /**
     * Applies cosmetic rules to request tab
     *
     * @param details request details
     */
    applyCosmetic(details) {
        const { tabId, url } = details;

        console.debug(`Processing tab ${tabId} changes..`);

        // This is a mock request, to do it properly we should pass main frame request with correct cosmetic option
        const { hostname } = new URL(url);
        const request = new TSUrlFilter.Request(hostname, null, TSUrlFilter.RequestType.Document);
        const cosmeticResult = this.engine.getCosmeticResult(request, TSUrlFilter.CosmeticOption.CosmeticOptionAll);

        applyCss(tabId, cosmeticResult);
        applyScripts(tabId, cosmeticResult);

        cosmeticResult.JS.specific.forEach((scriptRule) => {
            console.log(`[FILTERING-LOG][SCRIPT] Event rule: ${scriptRule.getText()}`);
        });
    }

    /**
     * Updates dynamic rules
     */
    updateDynamicDeclarativeRules() {
        const converter = new TSUrlFilter.DeclarativeConverter();
        const addRules = converter.convert(this.dynamicList);

        const removeRuleIds = addRules.map((r) => r.id);

        this.browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
    }

    /**
     * Gets matched declarative rules for specified tab.
     * This actually could be done on filtering log opening.
     *
     * @param details
     */
    async checkMatchedDeclarativeRules(details) {
        const matched = await this.browser.declarativeNetRequest.getMatchedRules({ tabId: details.tabId });
        if (matched) {
            matched.rulesMatchedInfo.forEach((m) => {
                // eslint-disable-next-line max-len
                console.log(`[FILTERING-LOG][DECLARATIVE] Tab: ${m.tabId} Matched rule: ${m.rule.ruleId} Rule set: ${m.rule.rulesetId}`);

                /**
                 * In this sample we will check dynamic list,
                 * but it could be done for static rules as well
                 */
                if (m.rule.rulesetId === this.DYNAMIC_LIST_ID) {
                    if (this.dynamicList) {
                        const source = this.dynamicList.retrieveRuleText(m.rule.ruleId);
                        if (source) {
                            console.log(`[FILTERING-LOG][DECLARATIVE] Tab: ${m.tabId} Source rule: ${source}`);
                        }
                    }
                }
            });
        }
    }
}
