import { type SourceRuleAndFilterId } from '@adguard/tsurlfilter/es/declarative-converter';

import { type RuleInfo, type RuleInfoOptional } from './content-script/rule-info';
import { type ContentType } from './request-type';
import { EventChannel, type EventChannelInterface } from './utils/channels';

// TODO: Add 'is' prefix to cssRule, scriptRule and contentRule properties.

/**
 * Types of filtering events that can occur during request processing.
 */
export enum FilteringEventType {
    SendRequest = 'sendRequest',
    TabReload = 'tabReload',
    ApplyBasicRule = 'applyBasicRule',
    ApplyCosmeticRule = 'applyCosmeticRule',
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
    StealthAllowlistAction = 'stealthAllowlistAction', // TODO: Add in MV3
    JsInject = 'jsInject',
    CspReportBlocked = 'cspReportBlocked', // TODO: Add in MV3
    /**
     * Used only in unpacked MV3.
     */
    MatchedDeclarativeRule = 'matchedDeclarativeRule',
}

/**
 * Advanced information about declarative network rule with source rule list and
 * stringified JSON version of declarative network rule.
 */
export type DeclarativeRuleInfo = {
    /**
     * Source rule list and filter id. Sometimes one declarative rule can be
     * generated from multiple source rules, that's why we use array here.
     */
    sourceRules: SourceRuleAndFilterId[];
    /**
     * DNR rule.
     */
    declarativeRuleJson: string;
};

/**
 * Additional network rule info.
 */
type AdditionalNetworkRuleInfo = {
    isAllowlist: boolean;
    isImportant: boolean;
    isDocumentLevel: boolean;
    isCsp: boolean;
    isCookie: boolean;
    advancedModifier: string | null;
};

/**
 * Unique event id for filtering events.
 */
type WithEventId = {
    /**
     * For proper filtering log request info rule displaying
     * event id should be unique for each event, not copied from request
     * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2341.
     */
    eventId: string;
};

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
    tabId: number;
    requestUrl: string;
    requestDomain: string | null;
    frameUrl: string;
    frameDomain: string | null;
    requestType: ContentType;
    timestamp: number;
    requestThirdParty: boolean;
    method: string;
} & WithEventId;

/**
 * Dispatched by WebRequestApi manifest v2 module on request in onBeforeRequest event handler.
 */
export type SendRequestEvent = {
    type: FilteringEventType.SendRequest;
    data: SendRequestEventData;
};

/**
 * {@link TabReloadEvent} Event data.
 */
export type PageReloadEventData = {
    tabId: number;
};

/**
 * Dispatched by WebRequestApi manifest v2 module on document request type handling in onBeforeRequest event handler.
 */
export type TabReloadEvent = {
    type: FilteringEventType.TabReload;
    data: PageReloadEventData;
};

/**
 * {@link ApplyBasicRuleEvent} Event data.
 */
export type ApplyBasicRuleEventData = {
    /**
     * Tab id.
     */
    tabId: number;

    /**
     * Request id.
     */
    requestId: string;

    /**
     * Request url.
     */
    requestUrl: string;

    /**
     * Frame url.
     */
    frameUrl: string;

    /**
     * Request type.
     */
    requestType: ContentType;

    /**
     * Category name from companiesdb matched by the request.
     */
    companyCategoryName?: string;

    /**
     * Flag indicating that the request is assuredly blocked.
     *
     * Needed for MV3 when some requests should not be logged as blocked
     * because they are wrongly detected as blocked,
     * i.e. truly blocked requests in MV3 are logged during onErrorOccurred event.
     */
    isAssuredlyBlocked?: boolean;
}
& RuleInfoOptional
& AdditionalNetworkRuleInfo
& WithEventId;

/**
 * Dispatched by WebRequestApi manifest v2 module on request block or allowlist rule matching in onBeforeRequest event
 * handler.
 */
export type ApplyBasicRuleEvent = {
    type: FilteringEventType.ApplyBasicRule;
    data: ApplyBasicRuleEventData;
};

/**
 * {@link ApplyCspRuleEvent} Event data.
 */
export type ApplyCspRuleEventData = {
    tabId: number;
    requestUrl: string;
    frameUrl: string;
    frameDomain: string | null;
    requestType: ContentType;
    timestamp: number;
} & RuleInfo & AdditionalNetworkRuleInfo & WithEventId;

/**
 * Dispatched by manifest v2 csp service.
 */
export type ApplyCspRuleEvent = {
    type: FilteringEventType.ApplyCspRule;
    data: ApplyCspRuleEventData;
};

export type ApplyPermissionsRuleEventData = ApplyCspRuleEventData;

export type ApplyPermissionsRuleEvent = {
    type: FilteringEventType.ApplyPermissionsRule;
    data: ApplyPermissionsRuleEventData;
};

/**
 * {@link ApplyCosmeticRuleEvent} Event data.
 */
export type ApplyCosmeticRuleEventData = {
    tabId: number;
    filterId: number;
    ruleIndex: number;
    element: string;
    frameUrl: string;
    frameDomain: string;
    requestType: ContentType;
    timestamp: number;
    cssRule: boolean;
    scriptRule: boolean;
    contentRule: boolean;
} & WithEventId;

/**
 * Dispatched by manifest v2 messageHandler in handleSaveCssHitsStats method and in ContentStream module on html rule
 * apply.
 */
export type ApplyCosmeticRuleEvent = {
    type: FilteringEventType.ApplyCosmeticRule;
    data: ApplyCosmeticRuleEventData;
};

/**
 * {@link ReceiveResponseEvent} Event data.
 */
export type ReceiveResponseEventData = {
    tabId: number;
    statusCode: number;
} & WithEventId;

/**
 * Dispatched by WebRequestApi manifest v2 module on response in onHeadersReceived event handler.
 */
export type ReceiveResponseEvent = {
    type: FilteringEventType.ReceiveResponse;
    data: ReceiveResponseEventData;
};

/**
 * {@link CookieEvent} Event data.
 */
export type CookieEventData = {
    tabId: number;
    cookieName: string;
    cookieValue: string;
    frameDomain: string;
    isModifyingCookieRule: boolean;
    requestThirdParty: boolean;
    timestamp: number;
    requestType: ContentType;
} & RuleInfo & AdditionalNetworkRuleInfo & WithEventId;

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
    removeHeader: boolean;
    headerName: string;
    tabId: number;
    requestUrl: string;
    frameUrl: string;
    frameDomain: string;
    requestType: ContentType;
    timestamp: number;
} & RuleInfo & AdditionalNetworkRuleInfo & WithEventId;

/**
 * Dispatched by RemoveHeadersService manifest v2 module on request header removing in onBeforeSendHeaders and
 * onHeadersReceived event handlers.
 * Cannot be detected in MV3 because browser applies $removeheader
 * (via DNR `modifyHeaders`) to request before passing it to extension.
 */
export type RemoveHeaderEvent = {
    type: FilteringEventType.RemoveHeader;
    data: RemoveHeaderEventData;
};

/**
 * {@link RemoveParamEvent} Event data.
 */
export type RemoveParamEventData = {
    removeParam: boolean;
    tabId: number;
    requestUrl: string;
    frameUrl: string;
    frameDomain: string;
    requestType: ContentType;
    timestamp: number;
} & RuleInfo & AdditionalNetworkRuleInfo & WithEventId;

/**
 * Dispatched by ParamsService manifest v2 module on request param removing in WebRequestApi.onBeforeRequest event
 * handler.
 * Cannot be detected in MV3 because browser applies $removeparam
 * (via DNR `redirect`) to request before passing it to extension.
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
    rules: RuleInfo[];
} & WithEventId;

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
    type: FilteringEventType.ContentFilteringStart;
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
    type: FilteringEventType.ContentFilteringFinish;
    data: ContentFilteringFinishEventData;
};

/**
 * {@link StealthActionEvent} Event data.
 */
export type StealthActionEventData = {
    tabId: number;
    /**
     * Applied stealth actions mask.
     */
    stealthActions: number;
} & WithEventId;

/**
 * Dispatched by StealthApi on stealth action apply in onBeforeSendHeaders event handler.
 */
export type StealthActionEvent = {
    type: FilteringEventType.StealthAction;
    data: StealthActionEventData;
};

/**
 * {@link StealthAllowlistActionEvent} Event data.
 */
export type StealthAllowlistActionEventData = {
    tabId: number;
    rules: (RuleInfo & AdditionalNetworkRuleInfo)[];
    requestUrl: string;
    frameUrl: string;
    requestType: ContentType;
    timestamp: number;
} & WithEventId;

/**
 * Dispatched by StealthApi on allowlist stealth rule matching in onBeforeSendHeaders event handler.
 */
export type StealthAllowlistActionEvent = {
    type: FilteringEventType.StealthAllowlistAction;
    data: StealthAllowlistActionEventData;
};

/**
 * {@link JsInjectEvent} Event data.
 */
export type JsInjectEventData = {
    tabId: number;
    script: boolean;
    requestUrl: string;
    frameUrl: string;
    frameDomain: string;
    requestType: ContentType;
    timestamp: number;
    filterId: number;
    ruleIndex: number;
    cssRule: boolean;
    scriptRule: boolean;
    contentRule: boolean;
} & WithEventId;

/**
 * Dispatched by manifest v2 WebRequest API injectJsScript method.
 */
export type JsInjectEvent = {
    type: FilteringEventType.JsInject;
    data: JsInjectEventData;
};

/**
 * {@link CspReportBlockedEvent} Event data.
 */
export type CspReportBlockedEventData = {
    tabId: number;
    cspReportBlocked: boolean;
} & WithEventId;

/**
 * Dispatched by manifest v2 WebRequestApi.onBeforeCspReport handler when
 * csp_report blocked in onBeforeRequest event handler.
 */
export type CspReportBlockedEvent = {
    type: FilteringEventType.CspReportBlocked;
    data: CspReportBlockedEventData;
};

/**
 * {@link DeclarativeRuleEvent} Event data.
 */
export type DeclarativeRuleEventData = {
    tabId: number;
    declarativeRuleInfo: DeclarativeRuleInfo;
} & WithEventId;

/**
 * Dispatched by manifest v3 chrome.declarativeNetRequest.onRuleMatchedDebug
 * handler when matched declarative rule for request.
 */
export type DeclarativeRuleEvent = {
    type: FilteringEventType.MatchedDeclarativeRule;
    data: DeclarativeRuleEventData;
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
    | StealthAllowlistActionEvent
    | SendRequestEvent
    | TabReloadEvent
    | ApplyBasicRuleEvent
    | ApplyCspRuleEvent
    | ApplyPermissionsRuleEvent
    | ApplyCosmeticRuleEvent
    | ReceiveResponseEvent
    | JsInjectEvent
    | CspReportBlockedEvent
    | DeclarativeRuleEvent;

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
    type: FilteringEventType;
    listener: FilteringLogListener<FilteringLogEvent>;
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
