/* eslint-disable no-console, import/extensions, import/no-unresolved */
import * as TSUrlFilter from '@adguard/tsurlfilter';

import { applyCss, applyScripts } from './cosmetic.js';
import { FilteringLog } from './filtering-log/filtering-log.js';
import { ModificationsListener } from './filtering-log/content-modifications.js';
import { RedirectsService } from './redirects-service.js';
import { applyCookieRules } from './cookie-helper.js';
import { injectStealthScripts } from './stealth-inject.js';

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
     * Content filtering support
     *
     * @type {boolean}
     */
    responseContentFilteringSupported = (typeof this.browser.webRequest !== 'undefined'
        && typeof this.browser.webRequest.filterResponseData !== 'undefined');

    /**
     * Content filtering module
     */
    contentFiltering = null;

    /**
     * Redirects service
     *
     * @type {RedirectsService}
     */
    redirectsService = new RedirectsService();

    /**
     * Cookie filtering service
     *
     * @type {CookieFiltering}
     */
    cookieFiltering = null;

    /**
     * Stealth configuration object
     */
    stealthConfig = {
        blockChromeClientData: false,
        hideReferrer: false,
        hideSearchQueries: false,
        sendDoNotTrack: true,
        selfDestructThirdPartyCookies: true,
        selfDestructThirdPartyCookiesTime: 2880,
        selfDestructFirstPartyCookies: false,
        selfDestructFirstPartyCookiesTime: 1,
    };

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

        // get stealth mode before engine start rules
        const STEALTH_MODE_FILTER_ID = -1;
        this.stealthService = new TSUrlFilter.StealthService(this.stealthConfig);
        const stealthModeList = new TSUrlFilter.StringRuleList(
            STEALTH_MODE_FILTER_ID,
            this.stealthService.getCookieRulesTexts().join('\n'),
            false,
        );

        const list = new TSUrlFilter.StringRuleList(1, rulesText, false);
        const ruleStorage = new TSUrlFilter.RuleStorage([list, stealthModeList]);

        this.engine = new TSUrlFilter.Engine(ruleStorage);
        this.dnsEngine = new TSUrlFilter.DnsEngine(ruleStorage);
        this.contentFiltering = new TSUrlFilter.ContentFiltering(new ModificationsListener(this.filteringLog));
        this.cookieFiltering = new TSUrlFilter.CookieFiltering(this.filteringLog);
        this.headersService = new TSUrlFilter.HeadersService(this.filteringLog);
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

        this.cookieFiltering.onBeforeRequest(details, this.getCookieRules(request, result));

        if (!requestRule || !requestRule.isAllowlist()) {
            let cleansedUrl = details.url;
            result.getRemoveParamRules().forEach((r) => {
                if (!r.isAllowlist()) {
                    cleansedUrl = r.getAdvancedModifier().removeParameters(cleansedUrl);
                }
            });

            if (cleansedUrl !== details.url) {
                console.debug(`Removeparam stripped tracking parameters for url: ${details.url}`);
                this.filteringLog.addStealthEvent(details.tabId, details.url, 'TRACKING_PARAMS');

                return { redirectUrl: cleansedUrl };
            }
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

        // Apply Html filtering and replace rules
        if (this.responseContentFilteringSupported) {
            const contentType = Application.getHeaderValueByName(responseHeaders, 'content-type');
            const replaceRules = this.getReplaceRules(details);
            const htmlRules = this.getHtmlRules(details);

            const requestType = Application.transformRequestType(details.type);
            const request = new TSUrlFilter.Request(details.url, details.initiator, requestType);
            request.requestId = details.requestId;
            request.tabId = details.tabId;
            request.statusCode = details.statusCode;
            request.method = details.method;

            this.contentFiltering.apply(
                this.browser.webRequest.filterResponseData(details.requestId),
                request,
                contentType,
                replaceRules,
                htmlRules,
            );
        }

        let responseHeadersModified = false;
        if (details.type === 'main_frame') {
            const cspHeaders = this.getCSPHeaders(details);
            console.debug(cspHeaders);

            if (cspHeaders && cspHeaders.length > 0) {
                responseHeaders = responseHeaders.concat(cspHeaders);
                responseHeadersModified = true;
            }
        }

        this.cookieFiltering.onHeadersReceived(details);

        if (this.headersService.onHeadersReceived(details, this.getRemoveHeaderRules(details))) {
            responseHeadersModified = true;
        }

        if (responseHeadersModified) {
            console.debug('Response headers modified');
            return { responseHeaders };
        }
    }

    /**
     * Called before request is sent to the remote endpoint.
     *
     * @param details Request details
     */
    onBeforeSendHeaders(details) {
        this.cookieFiltering.onBeforeSendHeaders(details);
        // eslint-disable-next-line max-len
        this.stealthService.processRequestHeaders(details.url, TSUrlFilter.RequestType.Document, details.requestHeaders);
        this.headersService.onBeforeSendHeaders(details, this.getRemoveHeaderRules(details));
    }

    /**
     * On completed listener
     *
     * @param details
     */
    onCompleted(details) {
        const blockingRules = this.cookieFiltering.getBlockingRules(details.requestId);
        applyCookieRules(details.tabId, blockingRules);

        this.cookieFiltering.onCompleted(details);

        injectStealthScripts(details.tabId, this.stealthConfig.sendDoNotTrack);
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
     * Returns replace rules matching request details
     *
     * @param details
     */
    getReplaceRules(details) {
        const request = new TSUrlFilter.Request(details.url, details.initiator, TSUrlFilter.RequestType.Document);
        const result = this.getMatchingResult(request);

        return result.getReplaceRules();
    }

    /**
     * Return $removeheader rules to apply
     *
     * @param details
     */
    getRemoveHeaderRules(details) {
        const request = new TSUrlFilter.Request(details.url, details.initiator, TSUrlFilter.RequestType.Document);
        const result = this.getMatchingResult(request);

        return result.getRemoveHeaderRules();
    }

    /**
     * Returns replace rules matching request details
     *
     * @param details
     */
    getHtmlRules(details) {
        const { hostname } = new URL(details.url);
        const cosmeticResult = this.engine.getCosmeticResult(hostname, TSUrlFilter.CosmeticOption.CosmeticOptionHtml);

        return cosmeticResult.Html.getRules();
    }

    /**
     * Returns cookie rules for request
     *
     * @param request
     * @param matchingResult
     * @return {NetworkRule[]}
     */
    getCookieRules(request, matchingResult) {
        const cookieRules = matchingResult.getCookieRules();
        return cookieRules;
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

    /**
     * Finds header object by header name (case insensitive)
     * @param headers Headers collection
     * @param headerName Header name
     * @returns {*}
     */
    static findHeaderByName(headers, headerName) {
        if (headers) {
            for (let i = 0; i < headers.length; i += 1) {
                const header = headers[i];
                if (header.name.toLowerCase() === headerName.toLowerCase()) {
                    return header;
                }
            }
        }
        return null;
    }

    /**
     * Finds header value by name (case insensitive)
     * @param headers Headers collection
     * @param headerName Header name
     * @returns {null}
     */
    static getHeaderValueByName(headers, headerName) {
        const header = this.findHeaderByName(headers, headerName);
        return header ? header.value : null;
    }
}
