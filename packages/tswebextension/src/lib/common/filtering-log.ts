import { NetworkRule, CosmeticRule } from '@adguard/tsurlfilter';
import { EventChannel } from './utils';

export const enum FilteringEventType {
    COOKIE = 'COOKIE',
    REMOVE_HEADER = 'REMOVE_HEADER',
    REMOVE_PARAM = 'REMOVE_PARAM',
    HTTP_RULE_APPLY = 'HTTP_RULE_APPLY',
    REPLACE_RULE_APPLY = 'REPLACE_RULE_APPLY',
    CONTENT_FILTERING_START = 'CONTENT_FILTERING_START',
    CONTENT_FILTERING_FINISH = 'CONTENT_FILTERING_FINISH',
    STEALTH_ACTION = 'STEALTH_ACTION',
}

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

export type CookieEvent = {
    type: FilteringEventType.COOKIE;
    data: CookieEventData;
};

export type RemoveHeaderEventData = {
    tabId: number;
    frameUrl: string;
    headerName: string;
    rule: NetworkRule;
};

export type RemoveHeaderEvent = {
    type: FilteringEventType.REMOVE_HEADER;
    data: RemoveHeaderEventData;
};

export type RemoveParamEventData = {
    tabId: number;
    frameUrl: string;
    paramName: string;
    rule: NetworkRule;
};

export type RemoveParamEvent = {
    type: FilteringEventType.REMOVE_PARAM;
    data: RemoveParamEventData;
};

export type HttpRuleApplyEventData = {
    tabId: number;
    requestId: string;
    elementString: string;
    frameUrl: string;
    rule: CosmeticRule;
};

export type HttpRuleApplyEvent = {
    type: FilteringEventType.HTTP_RULE_APPLY;
    data: HttpRuleApplyEventData;
};

export type ReplaceRuleApplyEventData = {
    tabId: number;
    requestId: string;
    frameUrl: string;
    rules: NetworkRule[];
};

export type ReplaceRuleApplyEvent = {
    type: FilteringEventType.REPLACE_RULE_APPLY;
    data: ReplaceRuleApplyEventData;
};

export type ContentFilteringStartEventData = {
    requestId: string;
};

export type ContentFilteringStartEvent = {
    type: FilteringEventType.CONTENT_FILTERING_START
    data: ContentFilteringStartEventData;
};

export type ContentFilteringFinishEventData = {
    requestId: string;
};

export type ContentFilteringFinishEvent = {
    type: FilteringEventType.CONTENT_FILTERING_FINISH
    data: ContentFilteringFinishEventData;
};

export type StealthActionEventData = {
    tabId: number;
    requestId: string;
    /**
     * Applied actions mask
     */
    actions: number;
};

export type StealthActionEvent = {
    type: FilteringEventType.STEALTH_ACTION
    data: StealthActionEventData;
};

export type FilteringLogEvent =
    | CookieEvent
    | RemoveHeaderEvent
    | RemoveParamEvent
    | HttpRuleApplyEvent
    | ReplaceRuleApplyEvent
    | ContentFilteringStartEvent
    | ContentFilteringFinishEvent
    | StealthActionEvent;

export interface FilteringLogInterface {
    /**
     * Add cookie rule event
     */
    addCookieEvent(data: CookieEventData): void;

    /**
     * Add header removed event
     */
    addRemoveHeaderEvent(data: RemoveHeaderEventData): void;

    /**
     * Add param removed event
     */
    addRemoveParamEvent(data: RemoveParamEventData): void;

    /**
     * Add html rule apply event
     */
    addHtmlRuleApplyEvent(data: HttpRuleApplyEventData): void;

    /**
     * Add replace rule apply event
     */
    addReplaceRuleApplyEvent(data: ReplaceRuleApplyEventData): void;

    /**
     * Add content filter working start event
     */
    addContentFilteringStartEvent(data: ContentFilteringStartEventData): void;

    /**
     * Add content filter working finish event
     */
    addContentFilteringFinishEvent(data: ContentFilteringFinishEventData): void;

    /**
     * Add stealth action event
     */
    addStealthActionEvent(data: StealthActionEventData): void;
}

export class FilteringLog implements FilteringLogInterface {
    onLogEvent = new EventChannel<FilteringLogEvent>();

    addCookieEvent(data: CookieEventData): void {
        this.onLogEvent.dispatch({
            type: FilteringEventType.COOKIE,
            data,
        });
    }

    addRemoveHeaderEvent(data: RemoveHeaderEventData): void {
        this.onLogEvent.dispatch({
            type: FilteringEventType.REMOVE_HEADER,
            data,
        });
    }

    addRemoveParamEvent(data: RemoveParamEventData): void {
        this.onLogEvent.dispatch({
            type: FilteringEventType.REMOVE_PARAM,
            data,
        });
    }

    addHtmlRuleApplyEvent(data: HttpRuleApplyEventData): void {
        this.onLogEvent.dispatch({
            type: FilteringEventType.HTTP_RULE_APPLY,
            data,
        });
    }

    addReplaceRuleApplyEvent(data: ReplaceRuleApplyEventData): void {
        this.onLogEvent.dispatch({
            type: FilteringEventType.REPLACE_RULE_APPLY,
            data,
        });
    }

    addContentFilteringStartEvent(data: ContentFilteringStartEventData): void {
        this.onLogEvent.dispatch({
            type: FilteringEventType.CONTENT_FILTERING_START,
            data,
        });
    }

    addContentFilteringFinishEvent(data: ContentFilteringFinishEventData): void {
        this.onLogEvent.dispatch({
            type: FilteringEventType.CONTENT_FILTERING_FINISH,
            data,
        });
    }

    addStealthActionEvent(data: StealthActionEventData): void {
        this.onLogEvent.dispatch({
            type: FilteringEventType.STEALTH_ACTION,
            data,
        });
    }
}

export const defaultFilteringLog = new FilteringLog();
