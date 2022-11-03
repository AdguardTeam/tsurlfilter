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
import { ContentType, EventChannelListener } from "@adguard/tswebextension";
export declare type RequestBlockingEvent = {
    tabId: number;
    requestUrl: string;
    referrerUrl: string;
    rule: string;
    filterId: number;
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
export declare class RequestBlockingLogger implements RequestBlockingLoggerInterface {
    private channel;
    constructor();
    addListener(listener: EventChannelListener<RequestBlockingEvent>): void;
    removeListener(listener: EventChannelListener<RequestBlockingEvent>): void;
    /**
     * Handles {@link ApplyBasicRuleEvent}, gets extra data for {@link requestContextStorage}
     * and dispatch new {@link RequestBlockingEvent}
     *
     * @param event - {@link ApplyBasicRuleEvent}
     */
    private onBasicRuleApply;
}
