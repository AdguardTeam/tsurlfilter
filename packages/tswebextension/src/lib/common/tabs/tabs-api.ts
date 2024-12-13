import { type RequestType } from '@adguard/tsurlfilter';

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
