/**
 * @file
 * This file is part of Adguard API library (https://github.com/AdguardTeam/tsurlfilter/packages/adguard-api).
 *
 * Adguard API is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard API is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adguard API. If not, see <http://www.gnu.org/licenses/>.
 */

import {
    type ApplyBasicRuleEvent,
    ContentType,
    defaultFilteringLog,
    EventChannel,
    type EventChannelListener,
    FilteringEventType,
} from '@adguard/tswebextension';

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
     * Filtering rule index which has blocked this request.
     */
    ruleIndex?: number;

    /**
     * Rule's filter identifier
     */
    filterId?: number;

    /**
     * Request mime type.
     */
    requestType: ContentType;
};

export interface RequestBlockingLoggerInterface {
    addListener(listener: EventChannelListener<RequestBlockingEvent>): void;
    removeListener(listener: EventChannelListener<RequestBlockingEvent>): void;
}

/**
 * API for adding and removing listeners for request blocking events.
 *
 * Wraps {@link defaultFilteringLog} {@link EventChannel} for {@link ApplyBasicRuleEvent}
 */
export class RequestBlockingLogger implements RequestBlockingLoggerInterface {
    private channel = new EventChannel<RequestBlockingEvent>();

    constructor() {
        this.onBasicRuleApply = this.onBasicRuleApply.bind(this);
        defaultFilteringLog.addEventListener(FilteringEventType.ApplyBasicRule, this.onBasicRuleApply);
    }

    // map public API to event channel

    public addListener(listener: EventChannelListener<RequestBlockingEvent>): void {
        this.channel.subscribe(listener);
    }

    public removeListener(listener: EventChannelListener<RequestBlockingEvent>): void {
        this.channel.unsubscribe(listener);
    }

    /**
     * Handles {@link ApplyBasicRuleEvent}, gets extra data for {@link requestContextStorage}
     * and dispatch new {@link RequestBlockingEvent}
     *
     * @param event - {@link ApplyBasicRuleEvent}
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

        if (filterId !== null && ruleIndex !== null) {
            resData.filterId = filterId;
            resData.ruleIndex = ruleIndex;
        }

        this.channel.dispatch(resData);
    }
}
