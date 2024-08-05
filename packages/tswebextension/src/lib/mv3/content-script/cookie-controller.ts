import { MessageType } from '../../common/message-constants';
import { type GetCookieRulesPayloadValidator } from '../../common/message';
import { sendAppMessage } from '../../common/content-script/send-app-message';
import {
    CookieController as CommonCookieController,
    type OnRuleAppliedData,
} from '../../common/content-script/cookie-controller';
import { type ContentScriptCookieRulesData } from '../background/messages-api';

/**
 * This class applies cookie rules in page context.
 *
 * Steps:
 * - content script requests matching cookie rules for the frame
 *   (in which this script is executed)
 * - service returns matching set of rules data to content script
 * - the rules are applied with {@link CookieController}
 * - filtering log receives callback with applied rules data.
 *
 * The important point is: there is no way to run cookie controller script via
 * browser.tabs.executeScript cause one only could be executed for all frames or
 * main frame only. But it's not correct cause there should be different rules
 * for each frame.
 */
export class CookieController {
    /**
     * Retry timeout for {@link MessageType.GetCookieRules} request to background in milliseconds.
     */
    private static GET_COOKIE_RULES_RETRY_TIMEOUT_MS = 100;

    /**
     * Max {@link MessageType.GetCookieRules} request limit.
     */
    private static MAX_GET_COOKIE_RULES_TRIES = 200;

    /**
     * Number of {@link MessageType.GetCookieRules} requests.
     */
    private tries = 0;

    /**
     * Creates new {@link CookieController} instance.
     */
    constructor() {
        this.process = this.process.bind(this);
    }

    /**
     * Init cookie rules processing.
     */
    public init(): void {
        this.process();
    }

    /**
     * Sends {@link MessageType.GetCosmeticData} message to background and process response.
     */
    private async process(): Promise<void> {
        const response: ContentScriptCookieRulesData | undefined = await sendAppMessage({
            type: MessageType.GetCookieRules,
            payload: {
                documentUrl: document.location.href,
            } as GetCookieRulesPayloadValidator,
        });

        if (response) {
            this.applyCookieRules(response);
        }
    }

    /**
     * Process {@link MessageType.ContentScriptCookieRulesData} response from background.
     *
     * If {@link response.isAppStarted} is false, retry
     * request after {@link GET_COOKIE_RULES_RETRY_TIMEOUT_MS} milliseconds.
     * Else apply cookie rules from {@link response.cookieRules}.
     *
     * @param response Response cookie rules data from background.
     */
    applyCookieRules = async (response: ContentScriptCookieRulesData): Promise<void> => {
        const { isAppStarted, cookieRules } = response;

        if (!isAppStarted && this.tries <= CookieController.MAX_GET_COOKIE_RULES_TRIES) {
            this.tries += 1;

            setTimeout(
                this.process,
                CookieController.GET_COOKIE_RULES_RETRY_TIMEOUT_MS,
            );

            return;
        }

        if (!response || cookieRules === undefined || cookieRules.length === 0) {
            return;
        }

        try {
            const onRuleApplied = (data: OnRuleAppliedData): void => {
                sendAppMessage({
                    type: MessageType.SaveCookieLogEvent,
                    payload: data,
                });
            };

            const cookieController = new CommonCookieController(onRuleApplied);

            cookieController.apply(cookieRules);
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
}
