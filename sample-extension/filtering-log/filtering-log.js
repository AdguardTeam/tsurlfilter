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
        };

        this.pushFilteringEvent(filteringEvent);
    }

    /**
     * Add event to log with the corresponding rule
     *
     * @param tabId
     * @param elementString
     * @param frameUrl
     * @param requestType
     * @param requestRule
     */
    addCosmeticEvent(tabId, elementString, frameUrl, requestType, requestRule) {
        if (!requestRule) {
            return;
        }

        const frameDomain = getDomainName(frameUrl);
        const filteringEvent = {
            element: elementString,
            frameUrl,
            frameDomain,
            requestType,
            rule: requestRule,
        };

        this.pushFilteringEvent(filteringEvent);
    };

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
        };

        this.pushFilteringEvent(filteringEvent);
    }

    // eslint-disable-next-line class-methods-use-this
    pushFilteringEvent(filteringEvent) {
        if (filteringEvent.rule) {
            console.log(`[FILTERING-LOG] Event rule: ${filteringEvent.rule.getText()}`);
            return;
        }

        console.log(`[FILTERING-LOG] Request: ${filteringEvent.requestUrl}`);
    }
}
