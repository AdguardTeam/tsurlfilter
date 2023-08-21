/* eslint-disable class-methods-use-this */
import { nanoid } from 'nanoid';
import browser, { Runtime } from 'webextension-polyfill';
import { CosmeticRule, NetworkRule, NetworkRuleOption } from '@adguard/tsurlfilter';

import { CookieRule } from '../../common/content-script/cookie-controller';
import { RequestBlockingApi } from './request';
import { ContentScriptCosmeticData, CosmeticApi } from './cosmetic-api';
import { CookieFiltering } from './services/cookie-filtering/cookie-filtering';

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
import { type CookieRule } from '../../common/content-script';
import { Assistant } from './assistant';
import { tabsApi } from './api';

export type MessageHandlerMV2 = (message: Message, sender: Runtime.MessageSender) => Promise<unknown>;

type MessageSenderMV2 = (tabId: number, message: unknown) => Promise<void>;

export interface MessagesApiInterface {
    sendMessage: MessageSenderMV2;
    handleMessage: MessageHandlerMV2;
}

// TODO: add long live connection
// TODO: CollectHitStats
/**
 * Messages API implementation. It is used to communicate with content scripts.
 */
export class MessagesApi implements MessagesApiInterface {
    filteringLog: FilteringLog;

    // TODO: use IoC container?
    /**
     * Assistant event listener.
     */
    onAssistantCreateRuleListener: undefined | ((ruleText: string) => void);

    /**
     * Messages API constructor.
     *
     * @param filteringLog Filtering log.
     */
    constructor(filteringLog: FilteringLog) {
        this.filteringLog = filteringLog;
        this.handleMessage = this.handleMessage.bind(this);
    }

    /**
     * Sends message to the specified tab.
     *
     * @param tabId Tab ID.
     * @param message Message.
     */
    public async sendMessage(tabId: number, message: unknown): Promise<void> {
        await browser.tabs.sendMessage(tabId, message);
    }

    /**
     * Messages handler.
     *
     * @param message Message object.
     * @param sender Tab which sent the message.
     */
    // TODO remove the rule bellow, and any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async handleMessage(message: Message, sender: Runtime.MessageSender): Promise<any> {
        try {
            message = messageValidator.parse(message);
        } catch (e) {
            // ignore
            return undefined;
        }

        const { type } = message;

        switch (type) {
            case MessageType.ProcessShouldCollapse: {
                return this.handleProcessShouldCollapseMessage(
                    sender,
                    message.payload,
                );
            }
            case MessageType.GetCosmeticData: {
                return this.handleContentScriptDataMessage(
                    sender,
                    message.payload,
                );
            }
            case MessageType.GetCookieRules: {
                return this.handleGetCookieRulesMessage(
                    sender,
                    message.payload,
                );
            }
            case MessageType.SaveCookieLogEvent: {
                return this.handleSaveCookieLogEvent(
                    sender,
                    message.payload,
                );
            }
            case MessageType.AssistantCreateRule: {
                return this.handleAssistantCreateRuleMessage(
                    sender,
                    message.payload,
                );
            }
            case MessageType.SaveCssHitsStats: {
                return this.handleSaveCssHitsStats(sender, message.payload);
            }
            default:
        }

        return undefined;
    }

    /**
     * Handles should collapse element message.
     *
     * @param sender Tab, which sent message.
     * @param payload Message payload.
     * @returns True if element should be collapsed.
     */
    private handleProcessShouldCollapseMessage(
        sender: Runtime.MessageSender,
        payload?: unknown,
    ): boolean {
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

    /**
     * Handles get extended css message.
     *
     * @param sender Tab, which sent message.
     * @param payload Message payload.
     * @returns Extended css string or false or undefined.
     */
    private handleContentScriptDataMessage(
        sender: Runtime.MessageSender,
        payload?: unknown,
    ): ContentScriptCosmeticData | null {
        if (!payload || !sender?.tab?.id) {
            return null;
        }

        const res = getExtendedCssPayloadValidator.safeParse(payload);

        if (!res.success) {
            return null;
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

        return CosmeticApi.getContentScriptData(tabId, frameId);
    }

    /**
     * Handles messages.
     * Returns cookie rules data for content script.
     *
     * @param sender Tab, which sent message.
     * @param payload Message payload.
     * @returns Cookie rules data.
     */
    private handleGetCookieRulesMessage(
        sender: Runtime.MessageSender,
        payload?: unknown,
    ): CookieRule[] {
        if (!payload || !sender?.tab?.id) {
            return [];
        }

        const res = getCookieRulesPayloadValidator.safeParse(payload);
        if (!res.success) {
            return [];
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

        const cookieRules = CookieFiltering.getBlockingRules(tabId, frameId);

        return cookieRules.map((rule) => ({
            ruleText: rule.getText(),
            match: rule.getAdvancedModifierValue(),
            isThirdParty: rule.isOptionEnabled(NetworkRuleOption.ThirdParty),
            filterId: rule.getFilterListId(),
            isAllowlist: rule.isAllowlist(),
        }));
    }

    /**
     * Calls filtering to add an event from cookie-controller content-script.
     *
     * @param sender Tab which sent the message.
     * @param payload Message payload.
     * @returns True if event was published to filtering log.
     */
    private handleSaveCookieLogEvent(
        sender: Runtime.MessageSender,
        payload?: unknown,
    ): boolean {
        if (!payload || !sender?.tab?.id) {
            return false;
        }

        const res = getSaveCookieLogEventPayloadValidator.safeParse(payload);
        if (!res.success) {
            return false;
        }

        const { data } = res;

        this.filteringLog.publishEvent({
            type: FilteringEventType.Cookie,
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
                requestType: ContentType.Cookie,
            },
        });

        return true;
    }

    /**
     * Handles message with new rule from assistant content script.
     *
     * @param sender Tab, which sent message.
     * @param payload Message payload.
     * @returns True if rule was dispatched.
     */
    private handleAssistantCreateRuleMessage(
        sender: Runtime.MessageSender,
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
     * Handle message about saving css hits stats.
     *
     * @param sender Tab, which sent message.
     * @param payload Message payload.
     * @returns True if stats was saved.
     */
    private handleSaveCssHitsStats(
        sender: Runtime.MessageSender,
        // TODO add payload type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload?: any,
    ): boolean {
        if (!payload || !sender?.tab?.id) {
            return false;
        }

        const tabId = sender.tab.id;

        const frame = tabsApi.getTabMainFrame(tabId);

        if (!frame?.url) {
            return false;
        }

        const { url } = frame;

        let published = false;

        for (let i = 0; i < payload.length; i += 1) {
            const stat = payload[i];
            const rule = new CosmeticRule(stat.ruleText, stat.filterId);

            this.filteringLog.publishEvent({
                type: FilteringEventType.ApplyCosmeticRule,
                data: {
                    tabId,
                    eventId: nanoid(),
                    rule,
                    element: stat.element,
                    frameUrl: url,
                    frameDomain: getDomain(url) as string,
                    requestType: ContentType.Document,
                    timestamp: Date.now(),
                },
            });
            published = true;
        }

        return published;
    }
}

export const messagesApi = new MessagesApi(defaultFilteringLog);
