/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-len */
import { NetworkRule, CosmeticRule } from '@adguard/tsurlfilter';
import { EventChannel } from './utils';

/**
 * Log events
 */

type CookieEvent = {
    tabId: number;
    cookieName: string;
    cookieValue: string;
    cookieDomain: string;
    cookieRule: NetworkRule;
    isModifyingCookieRule: boolean;
    thirdParty: boolean;
    timestamp: number;
};

type RemoveHeaderEvent = {
    tabId: number;
    frameUrl: string;
    headerName: string;
    rule: NetworkRule;
};

type RemoveParamEvent = {
    tabId: number;
    frameUrl: string;
    paramName: string;
    rule: NetworkRule;
};

type HttpRuleApplyEvent = {
    tabId: number;
    requestId: string;
    elementString: string;
    frameUrl: string;
    rule: CosmeticRule;
};

type ReplaceRuleApplyEvent = {
    tabId: number;
    requestId: string;
    frameUrl: string;
    rules: NetworkRule[];
};

type ContentFilteringStartEvent = {
    requestId: string;
};

type ContentFilteringFinishEvent = {
    requestId: string;
};

type StealthActionEvent = {
    tabId: number;
    requestId: string;
    /**
     * Applied actions mask
     */
    actions: number;
};


// TODO: unify type for output
/*

// Represents information about rule which blocked ad
// can be used in the stats of filtering log

interface RequestRule {
    filterId: number,
    ruleText: string,
    allowlistRule: boolean,
    cspRule: boolean,
    modifierValue: string | null,
    cookieRule: boolean
    cssRule: boolean,
}

// Represents data of filtering log event, can be used to display events
// in the filtering log, or collect stats to display on popup
interface FilteringLogEvent {
    // TODO complement with required fields
    tabId: number,
    eventId: number,
    // string representation of blocked dom node
    element?: string,
    requestUrl?: string,
    frameUrl: string,
    requestType: RequestType,
    timestamp: number,
    statusCode: number,
    method: RequestMethod,
    requestRule: RequestRule,
}
*/

export type FilteringLogEvent =
    | CookieEvent
    | RemoveHeaderEvent
    | RemoveParamEvent
    | HttpRuleApplyEvent
    | ReplaceRuleApplyEvent
    | ContentFilteringStartEvent
    | ContentFilteringFinishEvent
    | StealthActionEvent;

type FilteringLogOutput = (event: FilteringLogEvent) => void | Promise<void>;

export interface FilteringLogInterface {
    /**
     * Add cookie rule event
     */
    addCookieEvent(event: CookieEvent): void;

    /**
     * Add header removed event
     */
    addRemoveHeaderEvent(event: RemoveHeaderEvent): void;

    /**
     * Add param removed event
     */
    addRemoveParamEvent(event: RemoveParamEvent): void;

    /**
     * Add html rule apply event
     */
    addHtmlRuleApplyEvent(event: HttpRuleApplyEvent): void;

    /**
     * Add replace rule apply event
     */
    addReplaceRuleApplyEvent(event: ReplaceRuleApplyEvent): void;

    /**
     * Add content filter working start event
     */
    addContentFilteringStartEvent(event: ContentFilteringStartEvent): void;

    /**
     * Add content filter working finish event
     */
    addContentFilteringFinishEvent(event: ContentFilteringFinishEvent): void;

    /**
     * Add stealth action event
     */
    addStealthActionEvent(event: StealthActionEvent): void;
}

export class FilteringLog implements FilteringLogInterface {
    onLogEvent = new EventChannel<FilteringLogEvent>();

    addCookieEvent(event: CookieEvent): void {
        this.onLogEvent.dispatch(event);
    }

    addRemoveHeaderEvent(event: RemoveHeaderEvent): void {
        this.onLogEvent.dispatch(event);
    }

    addRemoveParamEvent(event: RemoveParamEvent): void {
        this.onLogEvent.dispatch(event);
    }

    addHtmlRuleApplyEvent(event: HttpRuleApplyEvent): void {
        this.onLogEvent.dispatch(event);
    }

    addReplaceRuleApplyEvent(event: ReplaceRuleApplyEvent): void {
        this.onLogEvent.dispatch(event);
    }

    addContentFilteringStartEvent(event: ContentFilteringStartEvent): void {
        this.onLogEvent.dispatch(event);
    }

    addContentFilteringFinishEvent(event: ContentFilteringFinishEvent): void {
        this.onLogEvent.dispatch(event);
    }

    addStealthActionEvent(event: StealthActionEvent): void {
        this.onLogEvent.dispatch(event);
    }
}

export const defaultFilteringLog = new FilteringLog();
