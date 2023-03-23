// Import directly from files to avoid side effects of tree shaking.
// If import from '../../common', entire tsurlfilter will be in the package.
import { MessageType, sendAppMessage } from '../../common/content-script';
import { CookieController } from './cookie-controller';
import { CosmeticController } from './cosmetic-controller';
import { initAssistant } from './assistant';

export * from '../../common/stealth-helper';
export * from './cookie-controller';

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
    const response = await sendAppMessage({
        type: MessageType.GetCookieRules,
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

            cookieController.apply(response.rulesData);
        } catch (e) {
            // Ignore exceptions
        }
    }
})();
