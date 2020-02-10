/* eslint-disable no-console, no-undef, import/extensions,import/no-unresolved, import/named */
import * as AGUrlFilter from './engine.js';
import { buildScriptText } from './injection-helper.js';

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
     * Applies scripts from cosmetic result
     *
     * @param tabId
     * @param cosmeticResult
     */
    const applyScripts = (tabId, cosmeticResult) => {
        const scripts = [...cosmeticResult.JS.generic, ...cosmeticResult.JS.specific];
        if (scripts.length === 0) {
            return;
        }

        const scriptsCode = scripts.join('\r\n');
        const toExecute = buildScriptText(scriptsCode);

        chrome.tabs.executeScript(tabId, {
            code: toExecute,
        });
    };

    /**
     * Applies css from cosmetic result
     *
     * @param tabId
     * @param cosmeticResult
     */
    const applyCss = (tabId, cosmeticResult) => {
        const css = [...cosmeticResult.elementHiding.generic, ...cosmeticResult.elementHiding.specific]
            .map((selector) => `${selector} { display: none!important; }`);

        // TODO: Apply extended css
        // eslint-disable-next-line max-len
        // const extendedCss = [...cosmeticResult.elementHiding.genericExtCss, ...cosmeticResult.elementHiding.specificExtCss];

        const styleText = css.join('\n');
        const injectDetails = {
            code: styleText,
            runAt: 'document_start',
        };

        chrome.tabs.insertCSS(tabId, injectDetails);
    };

    /**
     * Applies cosmetic rules to tab
     *
     * @param tabId
     * @param url
     */
    const applyCosmetic = (tabId, url) => {
        console.debug(`Processing tab ${tabId} changes..`);

        if (!isHttpOrWsRequest(url)) {
            return;
        }

        const { hostname } = new URL(url);
        const cosmeticResult = engine.getCosmeticResult(hostname, AGUrlFilter.CosmeticOption.CosmeticOptionAll);
        console.debug(cosmeticResult);

        applyCss(tabId, cosmeticResult);
        applyScripts(tabId, cosmeticResult);
    };

    /**
     * Add listener on tab updated
     */
    chrome.webNavigation.onCommitted.addListener((details) => {
        const { tabId, url } = details;
        applyCosmetic(tabId, url);
    });
})();
