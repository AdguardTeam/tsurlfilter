// Import directly from files to avoid side effects of tree shaking.
// If import from '../../common', entire tsurlfilter will be in the package.
import { MessageType, sendAppMessage } from '../../common/content-script';
import { CookieController, type CookieRule } from '../../common/content-script/cookie-controller';
import { CosmeticController } from './cosmetic-controller';
import { initAssistant } from './assistant';

export { StealthHelper } from '../../common/stealth-helper';
export { CookieController } from '../../common/content-script/cookie-controller';
export { CssHitsCounter } from './css-hits-counter';

const cosmeticController = new CosmeticController();
cosmeticController.init();

initAssistant();

/**
 * TODO: wait for engine starts (like in {@link CosmeticController}).
 *
 * Runs CookieController.
 *
 * Steps:
 * - content script requests matching cookie rules for the frame(in which this script is executed)
 * - service returns matching set of rules data to content script
 * - the rules are applied with TSUrlFilterContentScript.CookieController
 * - filtering log receives callback with applied rules data.
 *
 * The important point is:
 * - there is no way to run cookie controller script via chrome.tabs.executeScript cause one only could be executed
 * for all frames or main frame only. But it's not correct cause there should be different rules
 * for each frame.
 */
(async (): Promise<void> => {
    const response: undefined | CookieRule[] = await sendAppMessage({
        type: MessageType.GetCookieRules,
        payload: {
            documentUrl: window.location.href,
        },
    });

    // In some cases response can be undefined due to broken message channel.
    if (!response || response.length === 0) {
        return;
    }

    try {
        const cookieController = new CookieController(
            ({
                cookieName,
                cookieValue,
                cookieDomain,
                cookieRuleText,
                thirdParty,
                filterId,
            }) => {
                sendAppMessage({
                    type: MessageType.SaveCookieLogEvent,
                    payload: {
                        cookieName,
                        cookieValue,
                        cookieDomain,
                        cookieRuleText,
                        thirdParty,
                        filterId,
                    },
                });
            },
        );

        cookieController.apply(response);
    } catch (e) {
        /**
         * Content script injected on in every frame, but document cookie API in
         * iframes can be blocked by website CSP policy. We ignore this cases.
         * Content script matching defined in browser extension.
         * TODO: move error handling to it.
         */
    }
})();
