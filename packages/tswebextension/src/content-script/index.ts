import browser from 'webextension-polyfill';
import ExtendedCss, { IAffectedElement } from 'extended-css';
export * from './stealth-helper';
export * from './cookie-controller';
import { CssHitsCounter } from './css-hits-counter';

import { elementCollapser } from './element-collapser';
import { MessageType } from '../common';
import { CookieController } from './cookie-controller';

elementCollapser.start();

// TODO: replace to separate class

const applyExtendedCss = (cssText: string) => {
    // Init css hits counter
    const cssHitsCounter = new CssHitsCounter((stats) => {
        console.debug('Css stats ready');
        console.debug(stats);
    });

    console.debug('CssHitsCounter initialized');

    // Apply extended css stylesheets
    const extendedCss = new ExtendedCss({
        styleSheet: cssText,
        beforeStyleApplied: (el: IAffectedElement) => {
            return cssHitsCounter.countAffectedByExtendedCss(el);
        },
    });

    extendedCss.apply();

    console.debug('Extended css applied');
};

(async function () {
    /**
     * This content script executes in every page frame
     * We find nearest external source in window.top proxy
     * if this prop doesn't exist, read location data in frame context
     *
     * TODO: more intelligent search with base64 src url support etc.
     */
    const documentUrl = window.top?.location?.href || window.location.href;

    const res = await browser.runtime.sendMessage({
        type: MessageType.GET_EXTENDED_CSS,
        payload: {
            documentUrl,
        },
    }) as string;

    if (res) {
        applyExtendedCss(res);
    }
})();

/**
 * Runs CookieController
 *
 * * Steps:
 * - content script requests matching cookie rules for the frame(in which this script is executed)
 * - service returns matching set of rules data to content script
 * - the rules are applied with TSUrlFilterContentScript.CookieController
 * - filtering log receives callback with applied rules data
 *
 * The important point is:
 * - there is no way to run cookie controller script via chrome.tabs.executeScript cause one only could be executed
 * for all frames or main frame only. But it's not correct cause there should be different rules
 * for each frame.
 */
(async () => {
    const response = await browser.runtime.sendMessage({
        type: MessageType.GET_COOKIE_RULES,
        payload: {
            documentUrl: window.location.href,
        },
    });

    if (!response) {
        return;
    }

    if (response.rulesData) {
        try {
            const cookieController = new CookieController(
                ({
                    cookieName, cookieValue, cookieDomain, cookieRuleText, thirdParty, filterId,
                }) => {
                    browser.runtime.sendMessage({
                        type: MessageType.SAVE_COOKIE_LOG_EVENT,
                        data: {
                            cookieName, cookieValue, cookieDomain, cookieRuleText, thirdParty, filterId,
                        },
                    });
                },
            );

            cookieController.apply(response.rulesData);
        } catch (e) {
            // Ignore exceptions
        }
    }
})();
