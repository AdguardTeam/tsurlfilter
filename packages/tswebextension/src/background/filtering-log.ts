/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-len */
import { NetworkRule, CosmeticRule } from '@adguard/tsurlfilter';

/**
 * Filtering log interface
 */
export interface FilteringLog {

    /**
     * Add cookie rule event
     *
     * @param options
     */
    addCookieEvent(options: {
        tabId: number;
        cookieName: string;
        cookieValue: string;
        cookieDomain: string;
        cookieRule: NetworkRule;
        isModifyingCookieRule: boolean;
        thirdParty: boolean;
        timestamp: number;
    }): void;

    /**
     * Add header removed event
     *
     * @param tabId
     * @param headerName
     * @param rule
     */
    addRemoveHeaderEvent(
        tabId: number,
        frameUrl: string,
        headerName: string,
        rule: NetworkRule,
    ): void;

    /**
     * On html rule applied
     *
     * @param tabId - tab id
     * @param requestId - request id
     * @param elementString - element string presentation
     * @param frameUrl - Frame url
     * @param rule - rule
     */
    onHtmlRuleApplied(
        tabId: number, requestId: string, elementString: string, frameUrl: string, rule: CosmeticRule,
    ): void;

    /**
     * On replace rules applied
     *
     * @param tabId - tab id
     * @param requestId - request id
     * @param frameUrl - Frame url
     * @param rules - replace rules
     */
    onReplaceRulesApplied(
        tabId: number, requestId: string, frameUrl: string, rules: NetworkRule[],
    ): void;

    /**
     * On modification started
     *
     * @param requestId
     */
    onModificationStarted(requestId: string): void;

    /**
     * On modification completed
     *
     * @param requestId
     */
    onModificationFinished(requestId: string): void;

    /**
     * Binds applied stealth actions to HTTP request
     *
     * @param tabId Request tab id
     * @param requestId
     * @param actions Applied actions mask
     */
    bindStealthActionsToHttpRequestEvent(
        tabId: number, requestId:string, actions: number,
    ): void;
}

/**
 * TODO: Rework filtering log
 */
export class MockFilteringLog implements FilteringLog {
    addCookieEvent(options: { tabId: number; cookieName: string; cookieValue: string; cookieDomain: string; cookieRule: NetworkRule; isModifyingCookieRule: boolean; thirdParty: boolean; timestamp: number }): void {
    }

    addRemoveHeaderEvent(tabId: number, frameUrl: string, headerName: string, rule: NetworkRule): void {
    }

    onHtmlRuleApplied(tabId: number, requestId: string, elementString: string, frameUrl: string, rule: CosmeticRule): void {
    }

    onModificationFinished(requestId: string): void {
    }

    onModificationStarted(requestId: string): void {
    }

    onReplaceRulesApplied(tabId: number, requestId: string, frameUrl: string, rules: NetworkRule[]): void {
    }

    bindStealthActionsToHttpRequestEvent(tabId: number, requestId: string, actions: number): void {
    }
}

export const mockFilteringLog = new MockFilteringLog();
