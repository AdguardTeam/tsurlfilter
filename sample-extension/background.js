/* eslint-disable no-console, no-undef, import/extensions,import/no-unresolved, import/named, max-len */
import * as AGUrlFilter from './engine.js';
import { applyCss, applyScripts } from './cosmetic.js';

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
     * Initializes engine instance
     *
     * @param rulesText
     */
    const startEngine = (rulesText) => {
        console.log('Starting url filter engine');

        const list = new AGUrlFilter.StringRuleList(1, rulesText, false);
        const ruleStorage = new AGUrlFilter.RuleStorage([list]);
        const config = {
            engine: 'extension',
            version: chrome.runtime.getManifest().version,
            verbose: true,
        };

        const engine = new AGUrlFilter.Engine(ruleStorage, config);

        const journal = engine.getJournal();
        journal.on('request', (event) => {
            console.log(`[Request ${event.request.url}] Rules found: [${event.rules.length}]`);
            event.rules.forEach((r) => {
                console.debug(r.getText());
            });
        });

        console.log('Starting url filter engine..ok');

        return engine;
    };

    /**
     * Transform string to Request type object
     *
     * @param requestType
     * @return {RequestType}
     */
    const testGetRequestType = (requestType) => {
        switch (requestType) {
            case 'document':
                return AGUrlFilter.RequestType.Subdocument;
            case 'stylesheet':
                return AGUrlFilter.RequestType.Stylesheet;
            case 'font':
                return AGUrlFilter.RequestType.Font;
            case 'image':
                return AGUrlFilter.RequestType.Image;
            case 'media':
                return AGUrlFilter.RequestType.Media;
            case 'script':
                return AGUrlFilter.RequestType.Script;
            case 'xmlhttprequest':
                return AGUrlFilter.RequestType.XmlHttpRequest;
            case 'websocket':
                return AGUrlFilter.RequestType.Websocket;
            default:
                return AGUrlFilter.RequestType.Other;
        }
    };

    /**
     * If url is http or websocket
     *
     * @param url
     * @return {*|boolean}
     */
    const isHttpOrWsRequest = (url) => url && (url.indexOf('http') === 0 || url.indexOf('ws') === 0);

    const rulesText = await loadRules();
    const engine = await startEngine(rulesText);

    /**
     * Add on before request listener
     */
    // eslint-disable-next-line consistent-return
    chrome.webRequest.onBeforeRequest.addListener((details) => {
        console.debug('Processing request..');
        console.debug(details);

        const { url } = details;
        if (!isHttpOrWsRequest(url)) {
            return;
        }

        const requestType = testGetRequestType(details.type);
        const request = new AGUrlFilter.Request(url, details.initiator, requestType);
        const result = engine.matchRequest(request);

        console.debug(result);

        const requestRule = result.getBasicResult();

        if (requestRule
            && !requestRule.isWhitelist()) {
            // eslint-disable-next-line consistent-return
            return { cancel: true };
        }
    }, { urls: ['<all_urls>'] }, ['blocking']);

    /**
     * Applies cosmetic rules to tab
     *
     * @param details
     */
    const applyCosmetic = (details) => {
        const { tabId, url } = details;

        console.debug(`Processing tab ${tabId} changes..`);

        // This is a mock request, to do it properly we should pass main frame request with correct cosmetic option
        const request = new AGUrlFilter.Request(url, url, AGUrlFilter.RequestType.Document);
        const cosmeticResult = engine.getCosmeticResultForRequest(request, AGUrlFilter.CosmeticOption.CosmeticOptionAll);
        console.debug(cosmeticResult);

        applyCss(tabId, cosmeticResult);
        applyScripts(tabId, cosmeticResult);
    };

    /**
     * Add listener on tab updated
     */
    chrome.webNavigation.onCommitted.addListener((details) => {
        if (!isHttpOrWsRequest(details.url)) {
            return;
        }

        applyCosmetic(details);
    });

    /**
     * Modify CSP header to block WebSocket, prohibit data: and blob: frames and WebWorkers
     *
     * @param details
     * @returns {{responseHeaders: *}} CSP headers
     */
    const getCSPHeaders = (details) => {
        const request = new AGUrlFilter.Request(details.url, details.initiator, AGUrlFilter.RequestType.Document);
        const result = engine.matchRequest(request);

        const cspHeaders = [];
        const cspRules = result.getCspRules();
        if (cspRules) {
            for (let i = 0; i < cspRules.length; i += 1) {
                const rule = cspRules[i];
                cspHeaders.push({
                    name: 'Content-Security-Policy',
                    value: rule.getAdvancedModifierValue(),
                });
            }
        }

        return cspHeaders;
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
     * Add listener on headers received
     */
    chrome.webRequest.onHeadersReceived.addListener(onHeadersReceived, { urls: ['<all_urls>'] }, ['responseHeaders', 'blocking']);
    chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders, { urls: ['<all_urls>'] }, ['requestHeaders', 'blocking']);
})();
