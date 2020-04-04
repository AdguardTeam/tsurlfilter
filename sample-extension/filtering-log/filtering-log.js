/* eslint-disable no-console, import/extensions, import/no-unresolved, no-param-reassign */

import { getDomainName } from './utils.js';

/**
 * Filtering log
 */
export class FilteringLog {
    // TODO:
    // bindRuleToHttpRequestEvent,
    // bindReplaceRulesToHttpRequestEvent,

    /**
     * Constructor
     */
    constructor() {
        // eslint-disable-next-line no-undef
        chrome.runtime.onMessage.addListener(
            (request, sender) => {
                if (request.type === 'saveCssHitStats') {
                    const { id, url } = sender.tab;
                    const stats = JSON.parse(request.stats);
                    stats.forEach((s) => {
                        // Mock rule
                        const rule = {
                            getFilterListId() {
                                return s.filterId;
                            },
                            getText() {
                                return s.ruleText;
                            },
                        };

                        this.addCosmeticEvent(id, s.element, url, rule);
                    });
                }
            },
        );
    }


    /**
     * Add request to log
     *
     * @param tabId
     * @param requestUrl
     * @param frameUrl
     * @param requestRule
     */
    addHttpRequestEvent(tabId, requestUrl, frameUrl, requestRule) {
        const requestDomain = getDomainName(requestUrl);
        const frameDomain = getDomainName(frameUrl);

        const filteringEvent = {
            requestUrl,
            requestDomain,
            frameUrl,
            frameDomain,
            requestType: 'DOCUMENT',
            requestThirdParty: false,
            rule: requestRule,
            eventType: 'URL',
        };

        this.pushFilteringEvent(filteringEvent);
    }

    /**
     * Add event to log with the corresponding rule
     *
     * @param tabId
     * @param elementString
     * @param frameUrl
     * @param requestRule
     */
    addCosmeticEvent(tabId, elementString, frameUrl, requestRule) {
        if (!requestRule) {
            return;
        }

        const frameDomain = getDomainName(frameUrl);
        const filteringEvent = {
            element: elementString,
            frameUrl,
            frameDomain,
            requestType: 'DOCUMENT',
            rule: requestRule,
            eventType: 'CSS',
        };

        this.pushFilteringEvent(filteringEvent);
    }

    /**
     * Add script event to log with the corresponding rule
     *
     * @param {Number} tabId - tab id
     * @param {String} frameUrl - Frame url
     * @param {Object} rule - script rule
     */
    addScriptInjectionEvent(tabId, frameUrl, rule) {
        const frameDomain = getDomainName(frameUrl);
        const filteringEvent = {
            script: true,
            requestUrl: frameUrl,
            frameUrl,
            frameDomain,
            requestType: 'DOCUMENT',
            rule,
            eventType: 'SCRIPT',
        };

        this.pushFilteringEvent(filteringEvent);
    }

    /**
     * Add cookie event to log
     *
     * @param tabId
     * @param frameUrl
     * @param rule
     */
    addCookieEvent(tabId, frameUrl, rule) {
        const frameDomain = getDomainName(frameUrl);
        const filteringEvent = {
            frameDomain,
            requestType: 'COOKIE',
            rule,
            eventType: 'COOKIE',
        };

        this.pushFilteringEvent(filteringEvent);
    }

    // eslint-disable-next-line class-methods-use-this
    pushFilteringEvent(event) {
        if (event.rule) {
            console.log(`[FILTERING-LOG][${event.eventType}] Event rule: ${event.rule.getText()}`);
            return;
        }

        console.log(`[FILTERING-LOG] Request: ${event.requestUrl}`);
    }
}
