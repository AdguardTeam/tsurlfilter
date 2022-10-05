/* eslint-disable class-methods-use-this */
import { nanoid } from 'nanoid';
import browser, { Runtime } from 'webextension-polyfill';
import { CosmeticRule, NetworkRule, NetworkRuleOption } from '@adguard/tsurlfilter';

import { RequestBlockingApi } from './request';
import { CosmeticApi } from './cosmetic-api';
import { cookieFiltering } from './services/cookie-filtering/cookie-filtering';

import {
    getAssistantCreateRulePayloadValidator,
    getCookieRulesPayloadValidator,
    getExtendedCssPayloadValidator,
    getSaveCookieLogEventPayloadValidator,
    Message,
    MessageType,
    messageValidator,
    processShouldCollapsePayloadValidator,
    FilteringLog,
    defaultFilteringLog,
    FilteringEventType,
    getDomain,
    ContentType,
} from '../../common';
import { Assistant } from './assistant';
import { tabsApi } from './tabs';

export interface MessagesApiInterface {
    sendMessage: (tabId: number, message: unknown) => void;
    handleMessage: (message: Message, sender: Runtime.MessageSender) => Promise<unknown>;
}
// TODO: add long live connection
// TODO: CollectHitStats
export class MessagesApi implements MessagesApiInterface {
    filteringLog: FilteringLog;

    // TODO: use IoC container?
    /**
     * Assistant event listener
     */
    onAssistantCreateRuleListener: undefined | ((ruleText: string) => void);

    constructor(filteringLog: FilteringLog) {
        this.filteringLog = filteringLog;
        this.handleMessage = this.handleMessage.bind(this);
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

    public async handleMessage(message: Message, sender: Runtime.MessageSender) {
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
            case MessageType.SAVE_CSS_HITS_STATS: {
                return this.handleSaveCssHitsStats(sender, message.payload);
            }
            default:
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

        return RequestBlockingApi.shouldCollapseElement(tabId, elementUrl, documentUrl, requestType);
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
        let { frameId } = sender;

        if (!frameId) {
            frameId = 0;
        }

        // TODO check rules for parent/grandparent frames
        if (!tabsApi.getTabFrame(tabId, frameId)) {
            frameId = 0;
        }

        return CosmeticApi.getFrameExtCssText(tabId, frameId);
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
        let { frameId } = sender;

        if (!frameId) {
            frameId = 0;
        }

        // TODO check rules for parent/grandparent frames
        if (!tabsApi.getTabFrame(tabId, frameId)) {
            frameId = 0;
        }

        const cookieRules = cookieFiltering.getBlockingRules(tabId, frameId);

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

        const { data } = res;

        this.filteringLog.publishEvent({
            type: FilteringEventType.COOKIE,
            data: {
                eventId: nanoid(),
                tabId: sender.tab.id,
                cookieName: data.cookieName,
                frameDomain: data.cookieDomain,
                cookieValue: data.cookieValue,
                rule: new NetworkRule(data.ruleText, data.filterId),
                isModifyingCookieRule: false,
                requestThirdParty: data.thirdParty,
                timestamp: Date.now(),
                requestType: ContentType.COOKIE,
            },
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
        if (!res.success) {
            return false;
        }

        const { ruleText } = res.data;

        Assistant.onCreateRule.dispatch(ruleText);
    }

    private handleSaveCssHitsStats(
        sender: Runtime.MessageSender,
        payload?: any,
    ) {
        if (!payload || !sender?.tab?.id) {
            return false;
        }

        const tabId = sender.tab.id;

        const frame = tabsApi.getTabMainFrame(tabId);

        if (!frame?.url) {
            return;
        }

        const { url } = frame;

        for (let i = 0; i < payload.length; i += 1) {
            const stat = payload[i];
            const rule = new CosmeticRule(stat.ruleText, stat.filterId);

            this.filteringLog.publishEvent({
                type: FilteringEventType.APPLY_COSMETIC_RULE,
                data: {
                    tabId,
                    eventId: nanoid(),
                    rule,
                    element: stat.element,
                    frameUrl: url,
                    frameDomain: getDomain(url) as string,
                    requestType: ContentType.DOCUMENT,
                    timestamp: Date.now(),
                },
            });
        }
    }
}

export const messagesApi = new MessagesApi(defaultFilteringLog);
