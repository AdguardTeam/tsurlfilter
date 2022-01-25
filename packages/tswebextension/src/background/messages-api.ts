import browser, { Runtime } from 'webextension-polyfill';
import { NetworkRule, NetworkRuleOption } from '@adguard/tsurlfilter';

import { requestBlockingApi } from './request';
import {
    getAssistantCreateRulePayloadValidator,
    getCookieRulesPayloadValidator,
    getExtendedCssPayloadValidator,
    getSaveCookieLogEventPayloadValidator,
    Message,
    MessageType,
    messageValidator,
    processShouldCollapsePayloadValidator,
} from '../common';
import { cosmeticApi } from './cosmetic-api';
import { FilteringLog, mockFilteringLog } from './filtering-log';
import { cookieFiltering } from './services/cookie-filtering/cookie-filtering';

export interface MessagesApiInterface {
    start: () => void;
    stop: () => void;
    sendMessage: (tabId: number, message: unknown) => void;
    addAssistantCreateRuleListener: (listener: (ruleText: string) => void) => void;
}
// TODO: add long live connection
export class MessagesApi implements MessagesApiInterface {

    filteringLog: FilteringLog;

    /**
     * Assistant event listener
     */
    onAssistantCreateRuleListener: undefined | ((ruleText: string) => void) ;

    constructor(filteringLog: FilteringLog) {
        this.filteringLog = filteringLog;
        this.handleMessage = this.handleMessage.bind(this);
    }

    public start(): void {
        browser.runtime.onMessage.addListener(this.handleMessage);
    }

    public stop(): void {
        browser.runtime.onMessage.removeListener(this.handleMessage);
    }

    public sendMessage(tabId: number, message: unknown) {
        browser.tabs.sendMessage(tabId, message);
    }

    /**
     * Adds listener on rule created by assistant content script
     *
     * @param listener
     */
    public addAssistantCreateRuleListener(listener: (ruleText: string) => void): void {
        this.onAssistantCreateRuleListener = listener;
    }

    private async handleMessage(message: Message, sender: Runtime.MessageSender) {
        try {
            message = messageValidator.parse(message);
        } catch (e) {
            // ignore
            return;
        }

        const { type } = message;

        switch (type) {
            case MessageType.PROCESS_SHOULD_COLLAPSE: {
                return this.handleProcessShouldCollapseMessage(
                    sender,
                    message.payload,
                );
            }
            case MessageType.GET_EXTENDED_CSS: {
                return this.handleGetExtendedCssMessage(
                    sender,
                    message.payload,
                );
            }
            case MessageType.GET_COOKIE_RULES: {
                return this.handleGetCookieRulesMessage(
                    sender,
                    message.payload,
                );
            }
            case MessageType.SAVE_COOKIE_LOG_EVENT: {
                return this.handleSaveCookieLogEvent(
                    sender,
                    message.payload,
                );
            }
            case MessageType.ASSISTANT_CREATE_RULE: {
                return this.handleAssistantCreateRuleMessage(
                    sender,
                    message.payload,
                );
            }
            default:
                return;
        }
    }

    private handleProcessShouldCollapseMessage(
        sender: Runtime.MessageSender,
        payload?: unknown,
    ) {
        if (!payload || !sender?.tab?.id) {
            return false;
        }

        const res = processShouldCollapsePayloadValidator.safeParse(payload);

        if (!res.success) {
            return false;
        }

        const tabId = sender.tab.id;

        const { elementUrl, documentUrl, requestType } = res.data;

        return requestBlockingApi.processShouldCollapse(tabId, elementUrl, documentUrl, requestType);
    }

    private handleGetExtendedCssMessage(
        sender: Runtime.MessageSender,
        payload?: unknown,
    ) {
        if (!payload || !sender?.tab?.id) {
            return false;
        }

        const res = getExtendedCssPayloadValidator.safeParse(payload);

        if (!res.success) {
            return false;
        }

        const tabId = sender.tab.id;
        const frameId = sender.frameId || 0;

        const { documentUrl } = res.data;

        return cosmeticApi.getFrameExtCssText(documentUrl, tabId, frameId);
    }

    /**
     * Handles messages
     * Returns cookie rules data for content script
     *
     * @param sender
     * @param payload
     */
    private handleGetCookieRulesMessage(
        sender: Runtime.MessageSender,
        payload?: unknown,
    ) {
        if (!payload || !sender?.tab?.id) {
            return false;
        }

        const res = getCookieRulesPayloadValidator.safeParse(payload);
        if (!res.success) {
            return false;
        }

        const tabId = sender.tab.id;
        const frameId = sender.frameId || 0;

        const { documentUrl } = res.data;

        const cookieRules = cookieFiltering.getBlockingRules(documentUrl, tabId, frameId);

        return cookieRules.map((rule) => ({
            ruleText: rule.getText(),
            match: rule.getAdvancedModifierValue(),
            isThirdParty: rule.isOptionEnabled(NetworkRuleOption.ThirdParty),
            filterId: rule.getFilterListId(),
            isAllowlist: rule.isAllowlist(),
        }));
    }

    /**
     * Calls filtering to add an event from cookie-controller content-script
     *
     * @param sender
     * @param payload
     */
    private handleSaveCookieLogEvent(
        sender: Runtime.MessageSender,
        payload?: unknown,
    ) {
        if (!payload || !sender?.tab?.id) {
            return false;
        }

        const res = getSaveCookieLogEventPayloadValidator.safeParse(payload);
        if (!res.success) {
            return false;
        }

        const data = res.data;

        this.filteringLog.addCookieEvent({
            tabId: sender.tab.id,
            cookieName: data.cookieName,
            cookieDomain: data.cookieDomain,
            cookieValue: data.cookieValue,
            cookieRule: new NetworkRule(data.ruleText, data.filterId),
            isModifyingCookieRule: false,
            thirdParty: data.thirdParty,
            timestamp: Date.now(),
        });
    }

    /**
     * Handles message with new rule from assistant content script
     *
     * @param sender
     * @param payload
     */
    private handleAssistantCreateRuleMessage(
        sender: Runtime.MessageSender,
        payload?: unknown,
    ) {
        if (!payload || !sender?.tab?.id) {
            return false;
        }

        const res = getAssistantCreateRulePayloadValidator.safeParse(payload);
        if (!res.success){
            return false;
        }

        const { ruleText } = res.data;
        if (this.onAssistantCreateRuleListener) {
            this.onAssistantCreateRuleListener(ruleText);
        }
    }

}

export const messagesApi = new MessagesApi(mockFilteringLog);
