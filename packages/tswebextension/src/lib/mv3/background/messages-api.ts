import { NetworkRuleOption } from '@adguard/tsurlfilter';
import type browser from 'webextension-polyfill';
import { getDomain } from 'tldts';

import { MAIN_FRAME_ID } from '../../common/constants';
import { MessageType } from '../../common/message-constants';
import { type CookieRule } from '../../common/content-script/cookie-controller';
import { type ContentScriptCosmeticData } from '../../common/cosmetic-api';
import { defaultFilteringLog, FilteringEventType, type FilteringLog } from '../../common/filtering-log';
import {
    getAssistantCreateRulePayloadValidator,
    getSaveCookieLogEventPayloadValidator,
    getCookieRulesPayloadValidator,
    getCosmeticDataPayloadValidator,
    type Message,
    messageValidator,
} from '../../common/message';
import { ContentType } from '../../common/request-type';
import { isEmptySrcFrame } from '../../common/utils/is-empty-src-frame';
import { logger } from '../../common/utils/logger';
import { nanoid } from '../../common/utils/nanoid';
import { type TabsApi } from '../tabs/tabs-api';

import { type TsWebExtension } from './app';
import { appContext } from './app-context';
import { CosmeticApi } from './cosmetic-api';
import { CookieFiltering } from './services/cookie-filtering/cookie-filtering';
import { Assistant } from './assistant';

export type ContentScriptCookieRulesData = {
    /**
     * Is app started.
     */
    isAppStarted: boolean;

    /**
     * Cookie rules to apply.
     */
    cookieRules: CookieRule[] | undefined;
};

/**
 * MessageApi knows how to handle {@link Message}.
 * It is used to communicate with content scripts.
 *
 * TODO: Move to common folder.
 */
export class MessagesApi {
    /**
     * Creates new {@link MessagesApi}.
     *
     * @param tsWebExtension Current {@link TsWebExtension} app.
     * @param tabsApi Tabs API.
     * @param filteringLog Filtering log.
     *
     * @returns New {@link MessagesApi} handler.
     */
    constructor(
        private readonly tsWebExtension: TsWebExtension,
        private readonly tabsApi: TabsApi,
        private readonly filteringLog: FilteringLog,

    ) {
        this.handleMessage = this.handleMessage.bind(this);
    }

    /**
     * Handles message with {@link MessageType}.
     *
     * @param message Message.
     * @param sender Sender of message.
     *
     * @returns Data according to the received message.
     */
    public async handleMessage(
        message: Message,
        sender: browser.Runtime.MessageSender,
    ): Promise<unknown> {
        logger.trace('[tsweb.MessagesApi.handleMessage]: received: ', message);

        try {
            message = messageValidator.parse(message);
        } catch (e) {
            logger.error('[tsweb.MessagesApi.handleMessage]: cannot parse message: ', message);
            // Ignore this message
            return undefined;
        }

        const { type } = message;
        switch (type) {
            case MessageType.GetCosmeticData: {
                return this.handleGetCosmeticData(sender, message.payload);
            }
            case MessageType.AssistantCreateRule: {
                return this.handleAssistantCreateRuleMessage(
                    sender,
                    message.payload,
                );
            }
            case MessageType.GetCookieRules: {
                return this.getCookieRules(
                    sender,
                    message.payload,
                );
            }
            case MessageType.SaveCookieLogEvent: {
                return MessagesApi.handleSaveCookieLogEvent(
                    sender,
                    message.payload,
                );
            }
            case MessageType.SaveCssHitsStats: {
                return this.handleSaveCssHitsStats(sender, message.payload);
            }
            default: {
                logger.error('[tsweb.MessagesApi.handleMessage]: did not found handler for message');
            }
        }

        return undefined;
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
        sender: browser.Runtime.MessageSender,
        payload?: unknown,
    ): ContentScriptCosmeticData | undefined {
        logger.trace('[tsweb.MessagesApi.handleGetCosmeticData]: received call: ', payload);
        if (!payload || !sender?.tab?.id) {
            return undefined;
        }

        if (!this.tsWebExtension.isStarted) {
            logger.debug('[tsweb.MessagesApi.handleGetCosmeticData]: tswebextension is not started.');
            return undefined;
        }

        const res = getCosmeticDataPayloadValidator.safeParse(payload);
        if (!res.success) {
            logger.error('[tsweb.MessagesApi.handleGetCosmeticData]: cannot parse payload: ', payload, res.error);
            return undefined;
        }

        const tabId = sender.tab?.id;
        let { frameId } = sender;

        if (!frameId) {
            frameId = MAIN_FRAME_ID;
        }

        return CosmeticApi.getContentScriptData(res.data.documentUrl, tabId, frameId);
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
        sender: browser.Runtime.MessageSender,
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
        sender: browser.Runtime.MessageSender,
        payload?: unknown,
    ): ContentScriptCookieRulesData | undefined {
        logger.trace('[tsweb.MessagesApi.getCookieRules]: received call: ', payload);

        const { isStorageInitialized } = appContext;

        const data: ContentScriptCookieRulesData = {
            isAppStarted: false,
            cookieRules: [],
        };

        // if storage is not initialized, then app is not ready yet.
        if (!isStorageInitialized || !this.tsWebExtension.isStarted) {
            return data;
        }

        const res = getCookieRulesPayloadValidator.safeParse(payload);
        if (!res.success) {
            // this log message is added here as error for faster identification of the issue
            logger.error('[tsweb.MessagesApi.getCookieRules]: cannot parse payload: ', payload, res.error);
            return undefined;
        }

        const { documentUrl } = res.data;

        if (isEmptySrcFrame(documentUrl)) {
            logger.debug('[tsweb.MessagesApi.getCookieRules]: frame has empty src');
            return undefined;
        }

        const tabId = sender.tab?.id;
        if (tabId === undefined) {
            logger.debug('[tsweb.MessagesApi.getCookieRules]: tabId is undefined');
            return undefined;
        }

        data.isAppStarted = true;

        let { frameId } = sender;

        if (!frameId) {
            frameId = MAIN_FRAME_ID;
        }

        const cookieRules = CookieFiltering.getBlockingRules(documentUrl, tabId, frameId);

        data.cookieRules = cookieRules.map((rule) => ({
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

        return data;
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
        sender: browser.Runtime.MessageSender,
        // TODO add payload type
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

    /**
     * Calls filtering to add an event from cookie-controller content-script.
     *
     * @param sender Tab which sent the message.
     * @param payload Message payload.
     *
     * @returns True if event was published to filtering log.
     */
    private static handleSaveCookieLogEvent(
        sender: browser.Runtime.MessageSender,
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

        defaultFilteringLog.publishEvent({
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
}
