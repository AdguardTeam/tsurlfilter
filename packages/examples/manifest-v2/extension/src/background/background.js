/* eslint-disable no-console, no-undef, import/extensions, import/no-unresolved */
import * as TSUrlFilter from '@adguard/tsurlfilter';

import { Application } from './application.js';

export const background = async () => {
    /**
     * Loads rules
     *
     * @return rules text
     */
    const loadRules = async () => {
        const url = chrome.runtime.getURL('filters/test-rules.txt');
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

    // Load rules
    const rulesText = await loadRules();

    // This supposed to be done then rulesText is downloaded, before saving to local file
    // Rules text will be split and processed line by line
    const converted = TSUrlFilter.RuleConverter.convertRules(rulesText);

    // Start engine
    await application.startEngine(converted);

    /**
     * Add on before request listener
     */
    chrome.webRequest.onBeforeRequest.addListener((details) => {
        if (!isHttpOrWsRequest(details.url)) {
            return;
        }

        // eslint-disable-next-line consistent-return
        return application.onBeforeRequest(details);
    }, { urls: ['<all_urls>'] }, ['blocking']);

    /**
     * Add listener on headers received
     */
    chrome.webRequest.onHeadersReceived.addListener((details) => {
        if (!isHttpOrWsRequest(details.url)) {
            return;
        }

        // eslint-disable-next-line consistent-return
        return application.onResponseHeadersReceived(details);
    }, { urls: ['<all_urls>'] }, ['responseHeaders', 'blocking', 'extraHeaders']);

    /**
     * Add listener on tab updated
     */
    chrome.webNavigation.onCommitted.addListener((details) => {
        if (!isHttpOrWsRequest(details.url)) {
            return;
        }

        application.applyCosmetic(details);
    });
};
