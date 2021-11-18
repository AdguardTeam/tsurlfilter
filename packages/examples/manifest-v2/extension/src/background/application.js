/* eslint-disable no-console, import/extensions, import/no-unresolved */
import * as TSUrlFilter from '@adguard/tsurlfilter';

import { applyCss, applyScripts } from './cosmetic.js';
import { FilteringLog } from './filtering-log/filtering-log.js';
import { RedirectsService } from './redirects-service.js';

/**
 * Extension application class
 */
export class Application {
    /**
     * TS Engine instance
     */
    engine;

    /**
     * TS dns engine
     */
    dnsEngine;

    /**
     * Filtering log
     */
    filteringLog = new FilteringLog();

    // eslint-disable-next-line no-undef
    browser = chrome;

    /**
     * Redirects service
     *
     * @type {RedirectsService}
     */
    redirectsService = new RedirectsService();

    /**
     * Request details map
     */
    requestContextCache = new Map();

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

        const list = new TSUrlFilter.StringRuleList(1, rulesText, false);
        const ruleStorage = new TSUrlFilter.RuleStorage([list]);

        this.engine = new TSUrlFilter.Engine(ruleStorage);
        this.dnsEngine = new TSUrlFilter.DnsEngine(ruleStorage);

        await this.redirectsService.init();

        console.log('Starting url filter engine..ok');
    }

    /**
     * On before request handler
     *
     * @param details request details
     */
    // eslint-disable-next-line consistent-return
    onBeforeRequest(details) {
        console.debug('Processing request..');
        console.debug(details);

        const requestType = Application.transformRequestType(details.type);
        const request = new TSUrlFilter.Request(details.url, details.initiator, requestType);
        request.requestId = details.requestId;
        request.tabId = details.tabId;
        request.method = details.method;

        this.requestContextCache.set(request.requestId, { request });

        const dnsResult = this.dnsEngine.match(request.hostname);
        if (dnsResult.basicRule && !dnsResult.basicRule.isAllowlist()) {
            this.filteringLog.addDnsEvent(details.tabId, details.url, [dnsResult.basicRule]);
            return { cancel: true };
        }

        if (dnsResult.hostRules.length > 0) {
            this.filteringLog.addDnsEvent(details.tabId, details.url, dnsResult.hostRules);
            return { cancel: true };
        }

        const result = this.getMatchingResult(request);
        console.debug(result);

        const requestRule = result.getBasicResult();

        if (details.type === 'main_frame') {
            this.filteringLog.addHttpRequestEvent(details.tabId, details.url, requestRule);
        }

        if (requestRule && !requestRule.isAllowlist()) {
            if (requestRule.isOptionEnabled(TSUrlFilter.NetworkRuleOption.Redirect)) {
                const redirectUrl = this.redirectsService.createRedirectUrl(requestRule.getAdvancedModifierValue());
                if (redirectUrl) {
                    return { redirectUrl };
                }
            }

            return { cancel: true };
        }
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
        console.debug(cosmeticResult);

        applyCss(tabId, cosmeticResult);
        applyScripts(tabId, cosmeticResult);

        cosmeticResult.JS.specific.forEach((scriptRule) => {
            this.filteringLog.addScriptInjectionEvent(
                tabId,
                url,
                scriptRule,
            );
        });
    }

    /**
     * On response headers received handler
     *
     * @param details
     * @return {{responseHeaders: *}}
     */
    // eslint-disable-next-line consistent-return
    onResponseHeadersReceived(details) {
        let responseHeaders = details.responseHeaders || [];

        let responseHeadersModified = false;
        if (details.type === 'main_frame') {
            const cspHeaders = this.getCSPHeaders(details);
            console.debug(cspHeaders);

            if (cspHeaders && cspHeaders.length > 0) {
                responseHeaders = responseHeaders.concat(cspHeaders);
                responseHeadersModified = true;
            }
        }

        if (responseHeadersModified) {
            console.debug('Response headers modified');
            return { responseHeaders };
        }
    }

    /**
     * Frame rules cache
     * @type {Map<any, any>}
     */
    frameRules = new Map();

    /**
     * Records frame
     *
     * @param request
     */
    recordFrame(request) {
        const frameUrl = request.sourceUrl;
        const rule = this.engine.matchFrame(frameUrl);
        this.frameRules.set(frameUrl, rule);
    }

    /**
     * Returns frame rule if found
     *
     * @param request
     */
    getFrameRule(request) {
        return this.frameRules.get(request.sourceUrl);
    }

    /**
     * Gets matching result
     *
     * @return {MatchingResult}
     */
    getMatchingResult(request) {
        if (request.requestType === TSUrlFilter.RequestType.Document) {
            this.recordFrame(request);
        }

        const frameRule = this.getFrameRule(request);
        return this.engine.matchRequest(request, frameRule);
    }

    /**
     * Modify CSP header to block WebSocket, prohibit data: and blob: frames and WebWorkers
     *
     * @param details
     * @returns {{responseHeaders: *}} CSP headers
     */
    getCSPHeaders(details) {
        const request = new TSUrlFilter.Request(details.url, details.initiator, TSUrlFilter.RequestType.Document);
        const result = this.getMatchingResult(request);

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
    }

    /**
     * Transform string to Request type object
     *
     * @param requestType
     * @return {RequestType}
     */
    static transformRequestType(requestType) {
        switch (requestType) {
            case 'main_frame':
                return TSUrlFilter.RequestType.Document;
            case 'document':
                return TSUrlFilter.RequestType.Subdocument;
            case 'stylesheet':
                return TSUrlFilter.RequestType.Stylesheet;
            case 'font':
                return TSUrlFilter.RequestType.Font;
            case 'image':
                return TSUrlFilter.RequestType.Image;
            case 'media':
                return TSUrlFilter.RequestType.Media;
            case 'script':
                return TSUrlFilter.RequestType.Script;
            case 'xmlhttprequest':
                return TSUrlFilter.RequestType.XmlHttpRequest;
            case 'websocket':
                return TSUrlFilter.RequestType.Websocket;
            case 'ping':
            case 'beacon':
                return TSUrlFilter.RequestType.Ping;
            default:
                return TSUrlFilter.RequestType.Other;
        }
    }
}
