import { type MatchingResult, NetworkRuleOption, RequestType } from '@adguard/tsurlfilter';

import { CookieRule } from '../../common/content-script/cookie-controller';
import {
    getAssistantCreateRulePayloadValidator,
    getCssPayloadValidator,
} from '../../common';
import { isHttpOrWsRequest } from '../../common/utils';
import { logger } from '../utils/logger';

import { CosmeticRules, engineApi } from './engine-api';
import { TsWebExtension } from './app';
import { declarativeFilteringLog } from './declarative-filtering-log';
import {
    CommonMessageType,
    ExtendedMV3MessageType,
    MessageMV3,
    getCookieRulesPayloadValidator,
    messageMV3Validator,
} from './messages';
import { Assistant } from './assistant';

export type MessagesHandlerMV3 = (
    message: MessageMV3,
    sender: chrome.runtime.MessageSender,
) => Promise<unknown>;

/**
 * MessageApi knows how to handle {@link MessageMV3}.
 */
export class MessagesApi {
    /**
     * Stores link to {@link TsWebExtension} app to save context.
     */
    private tsWebExtension: TsWebExtension;

    /**
     * Creates new {@link MessagesApi}.
     *
     * @param tsWebExtension Current {@link TsWebExtension} app.
     *
     * @returns New {@link MessagesApi} handler.
     */
    constructor(tsWebExtension: TsWebExtension) {
        this.tsWebExtension = tsWebExtension;
        this.handleMessage = this.handleMessage.bind(this);
    }

    /**
     * Handles message with {@link CommonMessageType}
     * or {@link ExtendedMV3MessageType}.
     *
     * @param message Message.
     * @param sender Sender of message.
     *
     * @returns Data according to the received message.
     */
    public async handleMessage(
        message: MessageMV3,
        sender: chrome.runtime.MessageSender,
    ): Promise<unknown> {
        logger.debug('[HANDLE MESSAGE]: ', message);

        try {
            message = messageMV3Validator.parse(message);
        } catch (e) {
            logger.error('Bad message', message);
            // Ignore this message
            return undefined;
        }

        const { type } = message;
        switch (type) {
            case CommonMessageType.GetCss: {
                return this.getCss(sender, message.payload);
            }
            case ExtendedMV3MessageType.GetCollectedLog: {
                return declarativeFilteringLog.getCollected();
            }
            case CommonMessageType.AssistantCreateRule: {
                return this.handleAssistantCreateRuleMessage(
                    sender,
                    message.payload,
                );
            }
            case CommonMessageType.GetCookieRules: {
                return this.getCookieRules(
                    sender,
                    message.payload,
                );
            }
            default: {
                logger.error('Did not found handler for message');
            }
        }

        return undefined;
    }

    /**
     * Builds css for specified url.
     *
     * @param sender Tab, which sent message.
     * @param payload Message payload.
     *
     * @returns Cosmetic css or undefined if there are no css rules for this request.
     */
    private getCss(
        sender: chrome.runtime.MessageSender,
        payload?: unknown,
    ): CosmeticRules | undefined {
        logger.debug('[GET CSS]: received call ', payload);

        if (!this.tsWebExtension.isStarted) {
            return undefined;
        }

        const res = getCssPayloadValidator.safeParse(payload);
        if (!res.success) {
            return undefined;
        }

        const { url, referrer } = res.data;

        const result = MessagesApi.calculateMatchingResult(url, referrer, sender);

        const cosmeticOption = result?.getCosmeticOption();

        if (cosmeticOption === undefined) {
            return undefined;
        }

        return engineApi.buildCosmeticCss(
            url,
            cosmeticOption,
            false,
            false,
        );
    }

    /**
     * Handles message with new rule from assistant content script.
     *
     * @param sender An object containing information about the script context
     * that sent a message or request.
     * @param payload Object with rules text.
     *
     * @returns False if it cannot process the created rule,
     * or true for successful processing.
     */
    // eslint-disable-next-line class-methods-use-this
    private handleAssistantCreateRuleMessage(
        sender: chrome.runtime.MessageSender,
        payload?: unknown,
    ): boolean {
        if (!payload || !sender?.tab?.id) {
            return false;
        }

        const res = getAssistantCreateRulePayloadValidator.safeParse(payload);
        if (!res.success) {
            return false;
        }

        const { ruleText } = res.data;

        Assistant.onCreateRule.dispatch(ruleText);

        return true;
    }

    /**
     * Returns cookie rules data for content script.
     *
     * @param sender Tab, which sent message.
     * @param payload Message payload.
     *
     * @returns Cookie rules data.
     */
    private getCookieRules(
        sender: chrome.runtime.MessageSender,
        payload?: unknown,
    ): CookieRule[] | undefined {
        logger.debug('[GET COOKIE RULES]: received call ', payload);

        if (!this.tsWebExtension.isStarted) {
            return undefined;
        }

        const res = getCookieRulesPayloadValidator.safeParse(payload);
        if (!res.success) {
            return undefined;
        }

        const { url, referrer } = res.data;

        const result = MessagesApi.calculateMatchingResult(url, referrer, sender);

        if (!result) {
            return undefined;
        }

        const cookieRules = result.getCookieRules();

        return cookieRules.map((rule) => ({
            ruleText: rule.getText(),
            match: rule.getAdvancedModifierValue(),
            isThirdParty: rule.isOptionEnabled(NetworkRuleOption.ThirdParty),
            filterId: rule.getFilterListId(),
            isAllowlist: rule.isAllowlist(),
        }));
    }

    /**
     * Sends message to the specified tab.
     *
     * @param tabId The ID of the tab to send the message.
     * @param message Some payload to send to the tab.
     */
    public static async sendMessageToTab(tabId: number, message: unknown): Promise<void> {
        await chrome.tabs.sendMessage(tabId, message);
    }

    /**
     * Calculates matching result based on provided urls.
     *
     * @param url Current URL of document.
     * @param referrer The URL of the location that referred the user
     * to the current page.
     * @param sender An object containing information about the script context
     * that sent a message or request.
     *
     * @returns Null or matched result from engine if request has been matched
     * by some rule.
     */
    private static calculateMatchingResult(
        url: string,
        referrer: string,
        sender: chrome.runtime.MessageSender,
    ): MatchingResult | null {
        let isSubDocument = false;

        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1498
        // When document url for iframe is about:blank then we use tab url
        if (!isHttpOrWsRequest(url) && sender.frameId !== 0 && sender.tab?.url) {
            isSubDocument = true;
        }

        // TODO: Extract from cache
        return engineApi.matchRequest({
            requestUrl: url,
            frameUrl: referrer,
            // Always RequestType.Document or RequestType.SubDocument,
            // because in MV3 we request CSS for the already loaded page
            // from content-script.
            requestType: isSubDocument ? RequestType.SubDocument : RequestType.Document,
            frameRule: engineApi.matchFrame(url),
        });
    }
}
