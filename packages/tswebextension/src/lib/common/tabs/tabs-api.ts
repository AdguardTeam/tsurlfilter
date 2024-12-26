import { type Tabs } from 'webextension-polyfill';
import { type RequestType } from '@adguard/tsurlfilter';

/**
 * Tab information with defined tab id.
 *
 * We need tab id in the tab information, otherwise we do not process it.
 * For example developer tools tabs.
 */
export type TabInfoCommon = Tabs.Tab & {
    /**
     * Tab id.
     */
    id: number,
};

/**
 * Request context data related to the tab's frame.
 */
export type TabFrameRequestContextCommon = {
    /**
     * Tab id.
     */
    tabId: number;

    /**
     * Frame id.
     */
    frameId: number;

    /**
     * Request id.
     */
    requestId: string;

    /**
     * Request url.
     */
    requestUrl: string;

    /**
     * Request type.
     */
    requestType: RequestType;
};
