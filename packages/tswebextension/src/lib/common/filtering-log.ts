import { NetworkRule, CosmeticRule, RequestType } from '@adguard/tsurlfilter';
import { EventChannel, EventChannelInterface } from './utils';

/**
 * Types of filtering events that can occur during request processing
 */
export enum FilteringEventType {
    COOKIE = 'COOKIE',
    REMOVE_HEADER = 'REMOVE_HEADER',
    REMOVE_PARAM = 'REMOVE_PARAM',
    HTTP_RULE_APPLY = 'HTTP_RULE_APPLY',
    REPLACE_RULE_APPLY = 'REPLACE_RULE_APPLY',
    CONTENT_FILTERING_START = 'CONTENT_FILTERING_START',
    CONTENT_FILTERING_FINISH = 'CONTENT_FILTERING_FINISH',
    STEALTH_ACTION = 'STEALTH_ACTION',
    BLOCK_REQUEST = 'BLOCK_REQUEST',
}

/**
 * Type schemas for plain objects passed to
 * filtering event channels during request processing
 *
 * Used for type checking in generic {@link FilteringLog} methods
 *
 * Common filtering event type structure:
 * - type - {@link FilteringEventType}
 * - data - specified event data type schema
 */

/**
 * {@link BlockRequestEvent} event data
 */
export type BlockRequestEventData = {
    tabId: number,
    requestUrl: string,
    referrerUrl: string,
    requestType: RequestType,
    rule: string,
    filterId: number,
};

/**
 * Dispatched by WebRequestApi module on request blocking
 * in onBeforeRequest event handler
 */
export type BlockRequestEvent = {
    type: FilteringEventType.BLOCK_REQUEST
    data: BlockRequestEventData
};

/**
 * {@link CookieEvent} event data
 */
export type CookieEventData = {
    tabId: number;
    cookieName: string;
    cookieValue: string;
    cookieDomain: string;
    cookieRule: NetworkRule;
    isModifyingCookieRule: boolean;
    thirdParty: boolean;
    timestamp: number;
};

/**
 * Dispatched by CookieFiltering module on cookie filtering
 * in onBeforeSendHeaders and onHeadersReceived event handlers
 */
export type CookieEvent = {
    type: FilteringEventType.COOKIE;
    data: CookieEventData;
};

/**
 * {@link RemoveHeaderEvent} event data
 */
export type RemoveHeaderEventData = {
    tabId: number;
    frameUrl: string;
    headerName: string;
    rule: NetworkRule;
};

/**
 * Dispatched by HeadersService module on request header removing
 * in onBeforeSendHeaders and onHeadersReceived event handlers
 */
export type RemoveHeaderEvent = {
    type: FilteringEventType.REMOVE_HEADER;
    data: RemoveHeaderEventData;
};

/**
 * {@link RemoveParamEvent} event data
 */
export type RemoveParamEventData = {
    tabId: number;
    frameUrl: string;
    paramName: string;
    rule: NetworkRule;
};

/**
 * Dispatched by ParamsService module on request param removing
 * in WebRequestApi.onBeforeRequest event handler
 */
export type RemoveParamEvent = {
    type: FilteringEventType.REMOVE_PARAM;
    data: RemoveParamEventData;
};

/**
 * {@link HttpRuleApplyEvent} event data
 */
export type HttpRuleApplyEventData = {
    tabId: number;
    requestId: string;
    elementString: string;
    frameUrl: string;
    rule: CosmeticRule;
};

/**
 * Dispatched by ContentStringFilter module on http rule apply
 * while content filtering process
 */
export type HttpRuleApplyEvent = {
    type: FilteringEventType.HTTP_RULE_APPLY;
    data: HttpRuleApplyEventData;
};

/**
 * {@link ReplaceRuleApplyEvent} event data
 */
export type ReplaceRuleApplyEventData = {
    tabId: number;
    requestId: string;
    frameUrl: string;
    rules: NetworkRule[];
};

/**
 * Dispatched by ContentStringFilter module on replace rule apply
 * while content filtering process
 */
export type ReplaceRuleApplyEvent = {
    type: FilteringEventType.REPLACE_RULE_APPLY;
    data: ReplaceRuleApplyEventData;
};

/**
 * {@link ContentFilteringStartEvent} event data
 */
export type ContentFilteringStartEventData = {
    requestId: string;
};

/**
 * Dispatched by ContentStream module on start of data reading
 * while content filtering process
 */
export type ContentFilteringStartEvent = {
    type: FilteringEventType.CONTENT_FILTERING_START
    data: ContentFilteringStartEventData;
};

/**
 * {@link ContentFilteringFinishEvent} event data
 */
export type ContentFilteringFinishEventData = {
    requestId: string;
};

/**
 * Dispatched by ContentStream module on finish of data reading
 * while content filtering process
 */
export type ContentFilteringFinishEvent = {
    type: FilteringEventType.CONTENT_FILTERING_FINISH
    data: ContentFilteringFinishEventData;
};

/**
 * {@link StealthActionEvent} event data
 */
export type StealthActionEventData = {
    tabId: number;
    requestId: string;
    /**
     * Applied actions mask
     */
    actions: number;
};

/**
 * Dispatched by StealthApi on stealth action apply in
 * onBeforeSendHeaders event handler
 */
export type StealthActionEvent = {
    type: FilteringEventType.STEALTH_ACTION
    data: StealthActionEventData;
};

/**
 * Filtering events union
 *
 * Used for type extraction in generic {@link FilteringLog} methods
 * and common {@link FilteringLog.onLogEvent} channel event typing
 */
export type FilteringLogEvent =
    | CookieEvent
    | RemoveHeaderEvent
    | RemoveParamEvent
    | HttpRuleApplyEvent
    | ReplaceRuleApplyEvent
    | ContentFilteringStartEvent
    | ContentFilteringFinishEvent
    | StealthActionEvent
    | BlockRequestEvent;

/**
 * Utility type for mapping {@link FilteringEventType}
 * with specified {@link FilteringLogEvent}
 *
 * Used for type extraction in generic {@link FilteringLog} methods
 */
export type ExtractedFilteringLogEvent<P> = Extract<FilteringLogEvent, { type: P }>;

/**
 * Filtering event listener registered by {@link FilteringLog}
 */
export type FilteringLogListener<T> = (event: T) => void | Promise<void>;

/**
 * Data for mapping {@link FilteringEventType}
 * with specified registered {@link FilteringLogListener}
 */
export type FilteringLogEventChannel = {
    type: FilteringEventType,
    listener: FilteringLogListener<FilteringLogEvent>,
};

/**
 * Filtering log API
 */
export interface FilteringLogInterface {
    /**
     * {@link EventChannel} for listening all {@link FilteringLogEvent} events
     */
    onLogEvent: EventChannelInterface<FilteringLogEvent>;

    /**
     * Registers listener for specified {@link FilteringLogEvent}
     */
    addEventListener<T extends FilteringEventType>(
        type: T,
        listener: FilteringLogListener<ExtractedFilteringLogEvent<T>>
    ): void;

    /**
     * Dispatch {@link FilteringLogEvent} to {@link FilteringLog.onLogEvent}
     * and specified {@link FilteringLogListener} listeners, if they exist
     */
    publishEvent<T extends FilteringLogEvent>(event: T): void;
}

/**
 * {@link FilteringLogInterface} default implementation
 */
export class FilteringLog implements FilteringLogInterface {
    public onLogEvent = new EventChannel<FilteringLogEvent>();

    private channels: FilteringLogEventChannel[] = [];

    public addEventListener<T extends FilteringEventType>(
        type: T,
        listener: FilteringLogListener<ExtractedFilteringLogEvent<T>>,
    ): void {
        const channel = { type, listener } as FilteringLogEventChannel;

        this.channels.push(channel);
    }

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
 * Shared {@link FilteringLog} instance
 */
export const defaultFilteringLog = new FilteringLog();
