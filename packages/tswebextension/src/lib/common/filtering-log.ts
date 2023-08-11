import type { NetworkRule, CosmeticRule } from '@adguard/tsurlfilter';

import type { ContentType } from './request-type';
import { EventChannel, type EventChannelInterface } from './utils';

/**
 * Types of filtering events that can occur during request processing.
 */
export enum FilteringEventType {
    SendRequest = 'sendRequest',
    TabReload = 'tabReload',
    ApplyBasicRule = 'applyBasicRule',
    ApplyCosmeticRule = 'applyCosmeticRule',
    // TODO: Doesn't look like it's being used.
    ApplyCspRule = 'applyCspRule',
    ApplyPermissionsRule = 'applyPermissionsRule',
    ReceiveResponse = 'receiveResponse',
    Cookie = 'cookie',
    RemoveHeader = 'removeHeader',
    RemoveParam = 'removeParam',
    ReplaceRuleApply = 'replaceRuleApply',
    ContentFilteringStart = 'contentFilteringStart',
    ContentFilteringFinish = 'contentFilteringFinish',
    StealthAction = 'stealthAction',
    JsInject = 'jsInject',
}

/**
 * Type schemas for plain objects passed to filtering event channels during request processing.
 *
 * Used for type checking in generic {@link FilteringLog} methods.
 *
 * Common filtering event type structure:
 * - type - {@link FilteringEventType}
 * - data - specified event data type schema.
 */

/**
 * {@link SendRequestEvent} Event data.
 */
export type SendRequestEventData = {
    tabId: number,
    eventId: string,
    requestUrl: string,
    requestDomain: string | null,
    frameUrl: string,
    frameDomain: string | null,
    requestType: ContentType,
    timestamp: number,
    requestThirdParty: boolean,
    method: string,
};

/**
 * Dispatched by WebRequestApi manifest v2 module on request in onBeforeRequest event handler.
 */
export type SendRequestEvent = {
    type: FilteringEventType.SendRequest,
    data: SendRequestEventData,
};

/**
 * {@link TabReloadEvent} Event data.
 */
export type PageReloadEventData = {
    tabId: number,
};

/**
 * Dispatched by WebRequestApi manifest v2 module on document request type handling in onBeforeRequest event handler.
 */
export type TabReloadEvent = {
    type: FilteringEventType.TabReload,
    data: PageReloadEventData,
};

/**
 * {@link ApplyBasicRuleEvent} Event data.
 */
export type ApplyBasicRuleEventData = {
    tabId: number,
    eventId: string,
    rule: NetworkRule,
};

/**
 * Dispatched by WebRequestApi manifest v2 module on request block or allowlist rule matching in onBeforeRequest event
 * handler.
 */
export type ApplyBasicRuleEvent = {
    type: FilteringEventType.ApplyBasicRule,
    data: ApplyBasicRuleEventData,
};

/**
 * {@link ApplyCspRuleEvent} Event data.
 */
export type ApplyCspRuleEventData = {
    tabId: number,
    eventId: string,
    rule: NetworkRule,
    requestUrl: string,
    frameUrl: string,
    frameDomain: string | null,
    requestType: ContentType,
    timestamp: number,
};

/**
 * Dispatched by manifest v2 csp service.
 */
export type ApplyCspRuleEvent = {
    type: FilteringEventType.ApplyCspRule,
    data: ApplyCspRuleEventData,
};

export type ApplyPermissionsRuleEventData = ApplyCspRuleEventData;

export type ApplyPermissionsRuleEvent = {
    type: FilteringEventType.ApplyPermissionsRule,
    data: ApplyPermissionsRuleEventData,
};

/**
 * {@link ApplyCosmeticRuleEvent} Event data.
 */
export type ApplyCosmeticRuleEventData = {
    tabId: number,
    eventId: string,
    rule: CosmeticRule,
    element: string,
    frameUrl: string,
    frameDomain: string,
    requestType: ContentType,
    timestamp: number,
};

/**
 * Dispatched by manifest v2 messageHandler in handleSaveCssHitsStats method and in ContentStream module on html rule
 * apply.
 */
export type ApplyCosmeticRuleEvent = {
    type: FilteringEventType.ApplyCosmeticRule,
    data: ApplyCosmeticRuleEventData,
};

/**
 * {@link ReceiveResponseEvent} Event data.
 */
export type ReceiveResponseEventData = {
    tabId: number,
    eventId: string,
    statusCode: number,
};

/**
 * Dispatched by WebRequestApi manifest v2 module on response in onHeadersReceived event handler.
 */
export type ReceiveResponseEvent = {
    type: FilteringEventType.ReceiveResponse,
    data: ReceiveResponseEventData,
};

/**
 * {@link CookieEvent} Event data.
 */
export type CookieEventData = {
    eventId: string,
    tabId: number,
    cookieName: string,
    cookieValue: string,
    frameDomain: string,
    rule: NetworkRule,
    isModifyingCookieRule: boolean,
    requestThirdParty: boolean,
    timestamp: number,
    requestType: ContentType,
};

/**
 * Dispatched by CookieFiltering module on cookie filtering in
 * onBeforeSendHeaders and onHeadersReceived event handlers.
 */
export type CookieEvent = {
    type: FilteringEventType.Cookie;
    data: CookieEventData;
};

/**
 * {@link RemoveHeaderEvent} Event data.
 */
export type RemoveHeaderEventData = {
    removeHeader: boolean,
    headerName: string,
    eventId: string;
    tabId: number;
    requestUrl: string,
    frameUrl: string;
    frameDomain: string;
    requestType: ContentType;
    timestamp: number,
    rule: NetworkRule;
};

/**
 * Dispatched by RemoveHeadersService manifest v2 module on request header removing in onBeforeSendHeaders and
 * onHeadersReceived event handlers.
 */
export type RemoveHeaderEvent = {
    type: FilteringEventType.RemoveHeader;
    data: RemoveHeaderEventData;
};

/**
 * {@link RemoveParamEvent} Event data.
 */
export type RemoveParamEventData = {
    removeParam: boolean,
    eventId: string;
    tabId: number;
    requestUrl: string,
    frameUrl: string;
    frameDomain: string;
    requestType: ContentType;
    timestamp: number,
    rule: NetworkRule,
};

/**
 * Dispatched by ParamsService manifest v2 module on request param removing in WebRequestApi.onBeforeRequest event
 * handler.
 */
export type RemoveParamEvent = {
    type: FilteringEventType.RemoveParam;
    data: RemoveParamEventData;
};

/**
 * {@link ReplaceRuleApplyEvent} Event data.
 */
export type ReplaceRuleApplyEventData = {
    tabId: number;
    eventId: string;
    rules: NetworkRule[];
};

/**
 * Dispatched by ContentStringFilter manifest v2 module on replace rule apply while content filtering process.
 */
export type ReplaceRuleApplyEvent = {
    type: FilteringEventType.ReplaceRuleApply;
    data: ReplaceRuleApplyEventData;
};

/**
 * {@link ContentFilteringStartEvent} Event data.
 */
export type ContentFilteringStartEventData = {
    requestId: string;
};

/**
 * Dispatched by ContentStream manifest v2 module on start of data reading while content filtering process.
 */
export type ContentFilteringStartEvent = {
    type: FilteringEventType.ContentFilteringStart
    data: ContentFilteringStartEventData;
};

/**
 * {@link ContentFilteringFinishEvent} Event data.
 */
export type ContentFilteringFinishEventData = {
    requestId: string;
};

/**
 * Dispatched by ContentStream manifest v2 module on finish of data reading while content filtering process.
 */
export type ContentFilteringFinishEvent = {
    type: FilteringEventType.ContentFilteringFinish
    data: ContentFilteringFinishEventData;
};

/**
 * {@link StealthActionEvent} Event data.
 */
export type StealthActionEventData = {
    tabId: number;
    eventId: string;
    /**
     * Applied stealth actions mask.
     */
    stealthActions: number;
};

/**
 * Dispatched by manifest v2 StealthApi on stealth action apply in onBeforeSendHeaders event handler.
 */
export type StealthActionEvent = {
    type: FilteringEventType.StealthAction
    data: StealthActionEventData;
};

/**
 * {@link JsInjectEvent} Event data.
 */
export type JsInjectEventData = {
    eventId: string,
    tabId: number,
    script: boolean,
    requestUrl: string,
    frameUrl: string,
    frameDomain: string,
    requestType: ContentType,
    timestamp: number,
    rule: CosmeticRule,
};

/**
 * Dispatched by manifest v2 WebRequest API injectJsScript method.
 */
export type JsInjectEvent = {
    type: FilteringEventType.JsInject
    data: JsInjectEventData;
};

/**
 * Filtering events union.
 *
 * Used for type extraction in generic {@link FilteringLog} methods and common {@link FilteringLog.onLogEvent} channel
 * event typing.
 */
export type FilteringLogEvent =
    | CookieEvent
    | RemoveHeaderEvent
    | RemoveParamEvent
    | ReplaceRuleApplyEvent
    | ContentFilteringStartEvent
    | ContentFilteringFinishEvent
    | StealthActionEvent
    | SendRequestEvent
    | TabReloadEvent
    | ApplyBasicRuleEvent
    | ApplyCspRuleEvent
    | ApplyPermissionsRuleEvent
    | ApplyCosmeticRuleEvent
    | ReceiveResponseEvent
    | JsInjectEvent;

/**
 * Utility type for mapping {@link FilteringEventType} with specified {@link FilteringLogEvent}.
 *
 * Used for type extraction in generic {@link FilteringLog} methods.
 */
export type ExtractedFilteringLogEvent<P> = Extract<FilteringLogEvent, { type: P }>;

/**
 * Filtering event listener registered by {@link FilteringLog}.
 */
export type FilteringLogListener<T> = (event: T) => void | Promise<void>;

/**
 * Data for mapping {@link FilteringEventType} with specified registered {@link FilteringLogListener}.
 */
export type FilteringLogEventChannel = {
    type: FilteringEventType,
    listener: FilteringLogListener<FilteringLogEvent>,
};

/**
 * Filtering log API.
 */
export interface FilteringLogInterface {
    /**
     * {@link EventChannel} For listening all {@link FilteringLogEvent} events.
     */
    onLogEvent: EventChannelInterface<FilteringLogEvent>;

    /**
     * Registers listener for specified {@link FilteringLogEvent}.
     */
    addEventListener<T extends FilteringEventType>(
        type: T,
        listener: FilteringLogListener<ExtractedFilteringLogEvent<T>>
    ): void;

    /**
     * Dispatch {@link FilteringLogEvent} to {@link FilteringLog.onLogEvent} and specified {@link FilteringLogListener}
     * listeners, if they exist.
     */
    publishEvent<T extends FilteringLogEvent>(event: T): void;
}

/**
 * {@link FilteringLogInterface} Default implementation.
 */
export class FilteringLog implements FilteringLogInterface {
    public onLogEvent = new EventChannel<FilteringLogEvent>();

    private channels: FilteringLogEventChannel[] = [];

    /**
     * Registers listener for specified {@link FilteringLogEvent}.
     *
     * @param type Filtering log type.
     * @param listener Filtering log listener.
     */
    public addEventListener<T extends FilteringEventType>(
        type: T,
        listener: FilteringLogListener<ExtractedFilteringLogEvent<T>>,
    ): void {
        const channel = { type, listener } as FilteringLogEventChannel;

        this.channels.push(channel);
    }

    /**
     * Publishes event to attached listeners.
     *
     * @param event Filtering log event.
     */
    public publishEvent<T extends FilteringLogEvent>(event: T): void {
        const listeners = this.channels
            .filter(({ type }) => type === event.type)
            .map(({ listener }) => listener) as FilteringLogListener<T>[];

        for (const listener of listeners) {
            listener(event);
        }

        this.onLogEvent.dispatch(event);
    }
}

/**
 * Shared {@link FilteringLog} instance.
 */
export const defaultFilteringLog = new FilteringLog();
