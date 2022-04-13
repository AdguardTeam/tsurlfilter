/* eslint-disable no-console */
import ExtendedCss, { IAffectedElement } from 'extended-css';
import { CssHitsCounter } from './css-hits-counter';
import { ElementCollapser } from './element-collapser';
import { MessageType, sendAppMessage } from '../../common';
import { CookieController } from './cookie-controller';
import { initAssistant } from './assistant';

export * from '../../common/stealth-helper';
export * from './cookie-controller';

ElementCollapser.start();

initAssistant();

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

(async () => {
    const res = await sendAppMessage({
        type: MessageType.GET_EXTENDED_CSS,
        payload: {
            documentUrl: window.location.href,
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
    const response = await sendAppMessage({
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
                    sendAppMessage({
                        type: MessageType.SAVE_COOKIE_LOG_EVENT,
                        payload: {
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
