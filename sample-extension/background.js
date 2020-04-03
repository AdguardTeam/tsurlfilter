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

    /**
     * Add listener on before send headers
     */
    chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
        if (!isHttpOrWsRequest(details.url)) {
            return;
        }

        // eslint-disable-next-line consistent-return
        return application.onBeforeSendHeaders(details);
    }, { urls: ['<all_urls>'] }, ['requestHeaders', 'blocking']);

    /**
     * Called before request is sent to the remote endpoint.
     * This method is used to modify request in case of working in integration mode,
     * to modify headers for stealth service and also to record referrer header in frame data.
     *
     * @param details Request details
     * @returns {*} headers to send
     */
        // eslint-disable-next-line consistent-return
    const onBeforeSendHeaders = (details) => {
            const requestHeaders = details.requestHeaders || [];

            let requestHeadersModified = false;

            const cookieRules = getCookieRules(details);
            if (processHeaders(requestHeaders, cookieRules)) {
                requestHeadersModified = true;
            }

            if (requestHeadersModified) {
                console.log('Request headers modified');
                return { requestHeaders };
            }
        };

    /**
     * Returns cookie rules matching request details
     *
     * @param details
     * @return {NetworkRule[]}
     */
    const getCookieRules = (details) => {
        const request = new AGUrlFilter.Request(details.url, details.initiator, AGUrlFilter.RequestType.Document);
        const result = engine.matchRequest(request);

        return result.getCookieRules();
    };

    /**
     * Modifies cookie header
     *
     * @param headers
     * @param cookieRules
     * @return {null}
     */
    const processHeaders = (headers, cookieRules) => {
        console.log('Processing headers');

        console.debug(headers);
        console.debug(cookieRules);

        // TODO: Modify cookie header

        return null;
    };

    /**
     * On headers received callback function.
     * We do check request for safebrowsing
     * and check if websocket connections should be blocked.
     *
     * @param details Request details
     * @returns {{responseHeaders: *}} Headers to send
     */
        // eslint-disable-next-line consistent-return
    const onHeadersReceived = (details) => {
            let responseHeaders = details.responseHeaders || [];

            let responseHeadersModified = false;
            if (details.type === 'main_frame') {
                const cspHeaders = getCSPHeaders(details);
                console.debug(cspHeaders);

                if (cspHeaders && cspHeaders.length > 0) {
                    responseHeaders = responseHeaders.concat(cspHeaders);
                    responseHeadersModified = true;
                }
            }

            const cookieRules = getCookieRules(details);
            if (processHeaders(responseHeaders, cookieRules)) {
                responseHeadersModified = true;
            }

            if (responseHeadersModified) {
                console.log('Response headers modified');
                return { responseHeaders };
            }
        };
})();
