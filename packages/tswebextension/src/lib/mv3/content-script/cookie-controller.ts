import { MessageType } from '../../common/message-constants';
import { sendAppMessage } from '../../common/content-script/send-app-message';
import { CookieController } from '../../common/content-script/cookie-controller';

/**
 * Runs CookieController.
 *
 * Steps:
 * - content script requests matching cookie rules for the frame
 *   (in which this script is executed)
 * - service returns matching set of rules data to content script
 * - the rules are applied with {@link CookieController}
 * - filtering log receives callback with applied rules data.
 *
 * The important point is: there is no way to run cookie controller script via
 * chrome.tabs.executeScript cause one only could be executed for all frames or
 * main frame only. But it's not correct cause there should be different rules
 * for each frame.
 */
export const runCookieController = async (): Promise<void> => {
    const response = await sendAppMessage({
        type: MessageType.GetCookieRules,
        payload: {
            url: document.location.href,
            referrer: document.referrer,
        },
    });

    if (!response || response.length === 0) {
        return;
    }

    try {
        // TODO: Use this callback for filtering log
        // const onRuleAppliedCallback = (data: OnRuleAppliedData): void => {
        //     sendAppMessage({
        //         type: MessageType.SaveCookieLogEvent,
        //         payload: data,
        //     });
        // };

        const cookieController = new CookieController(() => {});

        cookieController.apply(response);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        /**
         * Content script injected on in every frame, but document cookie API in
         * iframes can be blocked by website CSP policy. We ignore this cases.
         * Content script matching defined in browser extension.
         * TODO: move error handling to it.
         */
    }
};
