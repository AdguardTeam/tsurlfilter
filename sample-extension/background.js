/* eslint-disable no-console, no-undef, import/extensions, import/no-unresolved */
import { Application } from './application.js';

(async () => {
    /**
     * Loads rules
     *
     * @return {Promise<void>}
     */
    const loadRules = async () => new Promise(((resolve) => {
        const url = chrome.runtime.getURL('test-rules.txt');
        fetch(url).then((response) => resolve(response.text()));
    }));

    /**
     * If url is http or websocket
     *
     * @param url
     * @return {*|boolean}
     */
    const isHttpOrWsRequest = (url) => url && (url.indexOf('http') === 0 || url.indexOf('ws') === 0);

    // Init application instance
    const application = new Application();

    // Load rules and start engine
    const rulesText = await loadRules();
    await application.startEngine(rulesText);

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
     * Add listener on tab updated
     */
    chrome.webNavigation.onCommitted.addListener((details) => {
        if (!isHttpOrWsRequest(details.url)) {
            return;
        }

        application.applyCosmetic(details);
    });

    /**
     * Add listener on headers received
     */
    chrome.webRequest.onHeadersReceived.addListener((details) => {
        if (!isHttpOrWsRequest(details.url)) {
            return;
        }

        // eslint-disable-next-line consistent-return
        return application.onResponseHeadersReceived(details);
    }, { urls: ['<all_urls>'] }, ['responseHeaders', 'blocking']);
})();
