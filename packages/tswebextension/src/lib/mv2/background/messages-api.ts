/* eslint-disable class-methods-use-this */
import { type Runtime } from 'webextension-polyfill';
import { NetworkRuleOption } from '@adguard/tsurlfilter';

import { MAIN_FRAME_ID } from '../../common/constants';
import { type CookieRule } from '../../common/content-script/cookie-controller';
import { type ContentScriptCosmeticData } from '../../common/cosmetic-api';
import { FilteringEventType, type FilteringLog } from '../../common/filtering-log';
import {
    getAssistantCreateRulePayloadValidator,
    getCookieRulesPayloadValidator,
    getExtendedCssPayloadValidator,
    getSaveCookieLogEventPayloadValidator,
    type Message,
    messageValidator,
    processShouldCollapsePayloadValidator,
} from '../../common/message';
import { MessageType } from '../../common/message-constants';
import { ContentType } from '../../common/request-type';
import { logger } from '../../common/utils/logger';
import { nanoid } from '../../common/utils/nanoid';
import { getDomain } from '../../common/utils/url';

import { Assistant } from './assistant';
import { CosmeticApi } from './cosmetic-api';
import { RequestBlockingApi } from './request';
import { cookieFiltering } from './services/cookie-filtering/cookie-filtering';
import { type TabsApi } from './tabs';

// TODO: add long live connection
// TODO: CollectHitStats
// TODO: Move to common folder
/**
 * Messages API implementation. It is used to communicate with content scripts.
 */
export class MessagesApi {
    /**
     * Messages API constructor.
     *
     * @param tabsApi Tabs API.
     * @param filteringLog Filtering log.
     */
    constructor(
        private readonly tabsApi: TabsApi,
        private readonly filteringLog: FilteringLog,
    ) {
        this.handleMessage = this.handleMessage.bind(this);
    }

    /**
     * Messages handler.
     *
     * @param message Message object.
     * @param sender Tab which sent the message.
     *
     * @returns Promise resolved with response to the message.
     */
    public async handleMessage(message: Message, sender: Runtime.MessageSender): Promise<unknown> {
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
                return this.handleGetCosmeticData(
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
     *
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
     * Handles get cosmetic message.
     *
     * @param sender Tab which sent message.
     * @param payload Message payload.
     *
     * @returns Content script data for applying cosmetic rules or null if no data.
     */
    private handleGetCosmeticData(
        sender: Runtime.MessageSender,
        payload?: unknown,
    ): ContentScriptCosmeticData | null {
        logger.trace('[tsweb.MessagesApi.handleGetCosmeticData]: received call: ', payload);
        if (!payload || !sender?.tab?.id) {
            return null;
        }

        const res = getExtendedCssPayloadValidator.safeParse(payload);

        if (!res.success) {
            logger.error('[tsweb.MessagesApi.handleGetCosmeticData]: cannot parse payload: ', payload, res.error);
            return null;
        }

        const tabId = sender.tab.id;
        let { frameId } = sender;

        if (!frameId) {
            frameId = MAIN_FRAME_ID;
        }

        return CosmeticApi.getContentScriptData(res.data.documentUrl, tabId, frameId);
    }

    /**
     * Handles messages.
     * Returns cookie rules data for content script.
     *
     * @param sender Tab, which sent message.
     * @param payload Message payload.
     *
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
            frameId = MAIN_FRAME_ID;
        }

        const cookieRules = cookieFiltering.getBlockingRules(res.data.documentUrl, tabId, frameId);

        return cookieRules.map((rule) => ({
            ruleIndex: rule.getIndex(),
            match: rule.getAdvancedModifierValue(),
            isThirdParty: rule.isOptionEnabled(NetworkRuleOption.ThirdParty),
            filterId: rule.getFilterListId(),
            isAllowlist: rule.isAllowlist(),
            isImportant: rule.isOptionEnabled(NetworkRuleOption.Important),
            isDocumentLevel: rule.isDocumentLevelAllowlistRule(),
            isCsp: rule.isOptionEnabled(NetworkRuleOption.Csp),
            isCookie: rule.isOptionEnabled(NetworkRuleOption.Cookie),
            advancedModifier: rule.getAdvancedModifierValue(),
        }));
    }

    /**
     * Calls filtering to add an event from cookie-controller content-script.
     *
     * @param sender Tab which sent the message.
     * @param payload Message payload.
     *
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
                filterId: data.filterId,
                ruleIndex: data.ruleIndex,
                isModifyingCookieRule: false,
                requestThirdParty: data.thirdParty,
                timestamp: Date.now(),
                requestType: ContentType.Cookie,
                // Additional rule properties
                isAllowlist: data.isAllowlist,
                isImportant: data.isImportant,
                isDocumentLevel: data.isDocumentLevel,
                isCsp: data.isCsp,
                isCookie: data.isCookie,
                advancedModifier: data.advancedModifier,
            },
        });

        return true;
    }

    /**
     * Handles message with new rule from assistant content script.
     *
     * @param sender Tab, which sent message.
     * @param payload Message payload.
     *
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
     *
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

        const tabContext = this.tabsApi.getTabContext(tabId);

        if (!tabContext?.info.url) {
            return false;
        }

        const { url } = tabContext.info;

        let published = false;

        for (let i = 0; i < payload.length; i += 1) {
            const stat = payload[i];

            this.filteringLog.publishEvent({
                type: FilteringEventType.ApplyCosmeticRule,
                data: {
                    tabId,
                    eventId: nanoid(),
                    filterId: stat.filterId,
                    ruleIndex: stat.ruleIndex,
                    element: stat.element,
                    frameUrl: url,
                    frameDomain: getDomain(url) as string,
                    requestType: ContentType.Document,
                    timestamp: Date.now(),
                    cssRule: true,
                    scriptRule: false,
                    contentRule: false,
                },
            });
            published = true;
        }

        return published;
    }
}
