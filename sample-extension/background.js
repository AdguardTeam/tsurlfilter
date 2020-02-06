/* eslint-disable no-console, no-undef */
// eslint-disable-next-line import/extensions
import * as AGUrlFilter from './engine.js';

(async () => {
    /**
     * Loads rules
     *
     * @return {Promise<void>}
     */
    const loadRules = async () => new Promise(((resolve) => {
        // eslint-disable-next-line no-undef
        const url = chrome.runtime.getURL('test-rules.txt');
        // eslint-disable-next-line no-undef
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
        const engine = new AGUrlFilter.Engine(ruleStorage);

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

    const rulesText = await loadRules();
    const engine = await startEngine(rulesText);

    /**
     * Add on before request listener
     */
    chrome.webRequest.onBeforeRequest.addListener((details) => {
        console.debug('Processing request..');
        console.debug(details);

        const request = new AGUrlFilter.Request(details.url, details.initiator, testGetRequestType(details.type));
        const result = engine.matchRequest(request);

        console.debug(result);
    }, { urls: ['<all_urls>'] }, ['blocking']);

    /**
     * Add listener for content script css and js request
     */
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'getSelectorsAndScripts') {
            console.debug('Processing content script request..');
            const { hostname } = new URL(request.documentUrl);

            const cosmeticResult = engine.getCosmeticResult(hostname, AGUrlFilter.CosmeticOption.CosmeticOptionAll);
            console.debug(cosmeticResult);

            const css = [...cosmeticResult.elementHiding.generic, ...cosmeticResult.elementHiding.specific]
                .map((selector) => `${selector} { display: none!important; }`);
            // eslint-disable-next-line max-len
            const extendedCss = [...cosmeticResult.elementHiding.genericExtCss, ...cosmeticResult.elementHiding.specificExtCss];
            const scripts = [...cosmeticResult.JS.generic, ...cosmeticResult.JS.specific];

            sendResponse({
                selectors: {
                    css,
                    extendedCss,
                },
                scripts,
            });
        }
    });
})();
