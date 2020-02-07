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
    // eslint-disable-next-line consistent-return
    chrome.webRequest.onBeforeRequest.addListener((details) => {
        console.debug('Processing request..');
        console.debug(details);

        const requestType = testGetRequestType(details.type);
        const request = new AGUrlFilter.Request(details.url, details.initiator, requestType);
        const result = engine.matchRequest(request);

        console.debug(result);

        const requestRule = result.getBasicResult();

        if (requestRule
            && !requestRule.isWhitelist()) {
            return { cancel: true };
        }
    }, { urls: ['<all_urls>'] }, ['blocking']);


    /**
     * Taken from
     * {@link https://github.com/seanl-adg/InlineResourceLiteral/blob/master/index.js#L136}
     * {@link https://github.com/joliss/js-string-escape/blob/master/index.js}
     */
    const reJsEscape = /["'\\\n\r\u2028\u2029]/g;
    const escapeJs = (match) => {
        switch (match) {
            case '"':
            case "'":
            case '\\':
                return `\\${match}`;
            case '\n':
                return '\\n\\\n'; // Line continuation character for ease
            // of reading inlined resource.
            case '\r':
                return ''; // Carriage returns won't have
            // any semantic meaning in JS
            case '\u2028':
                return '\\u2028';
            case '\u2029':
                return '\\u2029';
        }
    };

    /**
     * We use changing variable name because global properties
     * can be modified across isolated worlds of extension content page and tab page
     * https://bugs.chromium.org/p/project-zero/issues/detail?id=1225&desc=6
     */
    const variableName = `scriptExecuted${Date.now()}`;

    /**
     * Builds script to inject in a safe way;
     *
     * @param scriptText
     * @return {string|null}
     */
    const buildScriptText = (scriptText) => {
        if (!scriptText) {
            return null;
        }

        /**
         * Executes scripts in a scope of the page.
         * In order to prevent multiple script execution checks if script was already executed
         * Sometimes in Firefox when content-filtering is applied to the page race condition happens.
         * This causes an issue when the page doesn't have its document.head or document.documentElement at the moment of
         * injection. So script waits for them. But if a quantity of frame-requests reaches FRAME_REQUESTS_LIMIT then
         * script stops waiting with the error.
         * Description of the issue: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1004
         */
        const injectedScript = `(function() {\
                    if (window.${variableName}) {\
                        return;\
                    }\
                    var script = document.createElement("script");\
                    script.setAttribute("type", "text/javascript");\
                    script.textContent = "${scriptText.replace(reJsEscape, escapeJs)}";\
                    var FRAME_REQUESTS_LIMIT = 500;\
                    var frameRequests = 0;\
                    function waitParent () {\
                        frameRequests += 1;\
                        var parent = document.head || document.documentElement;\
                        if (parent) {\
                            try {\
                                parent.appendChild(script);\
                                parent.removeChild(script);\
                            } catch (e) {\
                            } finally {\
                                window.${variableName} = true;\
                                return true;\
                            }\
                        }\
                        if(frameRequests < FRAME_REQUESTS_LIMIT) {\
                            requestAnimationFrame(waitParent);\
                        } else {\
                            console.log("AdGuard: document.head or document.documentElement were unavailable too long");\
                        }\
                    }\
                    waitParent();\
                })()`;

        return injectedScript;
    };

    /**
     * Applies scripts from cosmetic result
     *
     * @param tabId
     * @param cosmeticResult
     */
    const applyScripts = (tabId, cosmeticResult) => {
        const scripts = [...cosmeticResult.JS.generic, ...cosmeticResult.JS.specific];
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
