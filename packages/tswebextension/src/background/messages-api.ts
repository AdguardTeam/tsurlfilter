import browser, { Runtime } from 'webextension-polyfill';
import { RequestType, CookieModifier, NetworkRuleOption, NetworkRule } from '@adguard/tsurlfilter';

import { requestBlockingApi } from './request';
import {
    getCookieRulesPayloadValidator,
    getExtendedCssPayloadValidator,
    getSaveCookieLogEventPayloadValidator,
    Message,
    MessageType,
    messageValidator,
    processShouldCollapsePayloadValidator,
} from '../common';
import { tabsApi } from './tabs';
import { engineApi } from './engine-api';
import { cosmeticApi } from './cosmetic-api';
import { FilteringLog, mockFilteringLog } from './filtering-log';

export interface MessagesApiInterface {
    start: () => void;
    stop: () => void;
    sendMessage: (tabId: number, message: unknown) => void;
}
// TODO: add long live connection
export class MessagesApi {

    filteringLog: FilteringLog;

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

        if (!res.success){
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

        if (!res.success){
            return false;
        }

        const tabId = sender.tab.id;

        const { documentUrl } = res.data;

        //TODO: replace to separate function

        const matchingResult = engineApi.matchRequest({
            requestUrl: documentUrl,
            frameUrl: documentUrl,
            requestType: RequestType.Document,
            frameRule: tabsApi.getTabFrameRule(tabId),
        });

        if (!matchingResult){
            return;
        }

        const cosmeticOption = matchingResult.getCosmeticOption();

        const cosmeticResult = engineApi.getCosmeticResult(documentUrl, cosmeticOption);
        const extCssText = cosmeticApi.getExtCssText(cosmeticResult);

        return extCssText;
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
        if (!res.success){
            return false;
        }

        const tabId = sender.tab.id;
        const { documentUrl } = res.data;

        // TODO: Is it possible to find corresponding request context?
        const matchingResult = engineApi.matchRequest({
            requestUrl: documentUrl,
            frameUrl: documentUrl,
            requestType: RequestType.Document,
            frameRule: tabsApi.getTabFrameRule(tabId),
        });

        if (!matchingResult) {
            return;
        }

        const blockingRules = matchingResult.getCookieRules().filter((rule) => {
            const cookieModifier = rule.getAdvancedModifier() as CookieModifier;
            return !cookieModifier.getSameSite() && !cookieModifier.getMaxAge();
        });

        return blockingRules.map((rule) => {
            return {
                ruleText: rule.getText(),
                match: rule.getAdvancedModifierValue(),
                isThirdParty: rule.isOptionEnabled(NetworkRuleOption.ThirdParty),
                filterId: rule.getFilterListId(),
                isAllowlist: rule.isAllowlist(),
            };
        });
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
        if (!res.success){
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

}

export const messagesApi = new MessagesApi(mockFilteringLog);
