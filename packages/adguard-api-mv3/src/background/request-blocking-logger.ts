/**
 * @file
 * This file is part of Adguard API MV3 library (https://github.com/AdguardTeam/tsurlfilter/packages/adguard-api-mv3).
 *
 * Adguard API MV3 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard API MV3 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adguard API MV3. If not, see <http://www.gnu.org/licenses/>.
 */

import {
    type ApplyBasicRuleEvent,
    type ContentType,
    defaultFilteringLog,
    EventChannel,
    type EventChannelListener,
    FilteringEventType,
} from '@adguard/tswebextension/mv3';

export type RequestBlockingEvent = {
    /**
     * Tab identifier.
     */
    tabId: number;

    /**
     * Blocked request id.
     */
    requestId: string;

    /**
     * Blocked request URL.
     */
    requestUrl: string;

    /**
     * Referrer URL.
     */
    referrerUrl: string;

    /**
     * Request mime type.
     */
    requestType: ContentType;

    /**
     * Assumed Filtering rule, which has blocked this request. May not be provided if request is blocked by DNR rule.
     */
    assumedRuleIndex?: number;

    /**
     * Assumed rule's filter identifier. May not be provided if request is blocked by DNR rule.
     */
    assumedFilterId?: number;

    /**
     * Company category name for requests blocked by DNR rule. Provided if request is blocked by DNR rule.
     */
    companyCategoryName?: string;
};

export interface RequestBlockingLoggerInterface {
    addListener(listener: EventChannelListener<RequestBlockingEvent>): void;
    removeListener(listener: EventChannelListener<RequestBlockingEvent>): void;
}

/**
 * API for adding and removing listeners for request blocking events.
 * Wraps {@link defaultFilteringLog} {@link EventChannel} for {@link ApplyBasicRuleEvent}.
 */
export class RequestBlockingLogger implements RequestBlockingLoggerInterface {
    private channel = new EventChannel<RequestBlockingEvent>();

    /**
     * Create instance of {@link RequestBlockingLogger}.
     */
    constructor() {
        this.onBasicRuleApply = this.onBasicRuleApply.bind(this);

        defaultFilteringLog.addEventListener(FilteringEventType.ApplyBasicRule, this.onBasicRuleApply);
    }

    // map public API to event channel

    /**
     * Register listener for {@link RequestBlockingEvent}.
     *
     * @param listener Function to be called when {@link RequestBlockingEvent} is dispatched.
     */
    public addListener(listener: EventChannelListener<RequestBlockingEvent>): void {
        this.channel.subscribe(listener);
    }

    /**
     * Unregister listener for {@link RequestBlockingEvent}.
     *
     * @param listener Function to be called when {@link RequestBlockingEvent} is dispatched.
     */
    public removeListener(listener: EventChannelListener<RequestBlockingEvent>): void {
        this.channel.unsubscribe(listener);
    }

    /**
     * Handles {@link ApplyBasicRuleEvent}, gets extra data for {@link requestContextStorage}
     * and dispatch new {@link RequestBlockingEvent}.
     *
     * @param event {@link ApplyBasicRuleEvent}.
     *
     * @throws An error if MV3-required property "companyCategoryName" is missing.
     */
    private onBasicRuleApply(event: ApplyBasicRuleEvent): void {
        const {
            tabId,
            requestId,
            requestUrl,
            requestType,
            frameUrl,
            filterId,
            ruleIndex,
            isAllowlist,
            companyCategoryName,
        } = event.data;

        // exclude allowlist rules
        if (isAllowlist) {
            return;
        }

        const resData: RequestBlockingEvent = {
            tabId,
            requestId,
            requestUrl,
            referrerUrl: frameUrl,
            requestType,
        };

        // add optional fields only if they are provided
        if (companyCategoryName) {
            resData.companyCategoryName = companyCategoryName;
        }

        if (filterId !== null && ruleIndex !== null) {
            resData.assumedFilterId = filterId;
            resData.assumedRuleIndex = ruleIndex;
        }

        this.channel.dispatch(resData);
    }
}
