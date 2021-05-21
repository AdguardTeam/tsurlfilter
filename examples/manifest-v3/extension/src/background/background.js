/* eslint-disable no-console, no-undef, import/extensions, import/no-unresolved */
// eslint-disable-next-line import/no-extraneous-dependencies
import * as TSUrlFilter from '@adguard/tsurlfilter';
import { Application } from './application.js';

export const background = async () => {
    /**
     * Loads rules
     *
     * @return rules text
     */
    const loadRules = async () => {
        const url = chrome.runtime.getURL('filters/dynamic.txt');
        const response = await fetch(url);
        return response.text();
    };

    /**
     * If url is http or websocket
     *
     * @param url
     * @return {*|boolean}
     */
    const isHttpOrWsRequest = (url) => url && (url.indexOf('http') === 0 || url.indexOf('ws') === 0);

    // Init application instance
    const application = new Application();

    // Load dynamic rules
    const rulesText = await loadRules();
    const converted = TSUrlFilter.RuleConverter.convertRules(rulesText);

    // Start engine
    await application.startEngine(converted);

    /**
     * Add listener on tab updated
     */
    chrome.webNavigation.onCommitted.addListener((details) => {
        if (!isHttpOrWsRequest(details.url)) {
            return;
        }

        application.applyCosmetic(details);

        application.checkMatchedDeclarativeRules(details);
    });
};
