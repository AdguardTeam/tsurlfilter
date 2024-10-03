import browser from 'webextension-polyfill';
import { type RequestType } from '@adguard/tsurlfilter/es/request-type';
import type { NetworkRule } from '@adguard/tsurlfilter';
import type { Tabs } from 'webextension-polyfill';

import { identity } from 'lodash-es';
import { Frame } from './frame';
import {
    type FilteringLog,
    defaultFilteringLog,
} from '../../common/filtering-log';
import { isHttpOrWsRequest } from '../../common/utils/url';
import { DocumentApi } from '../background/document-api';
import { MAIN_FRAME_ID } from '../../common/constants';
import { Frames } from './frames';

/**
 * We need tab id in the tab information, otherwise we do not process it.
 * For example developer tools tabs.
 */
export type TabInfo = Tabs.Tab & {
    id: number,
};

/**
 * Request context data related to the frame.
 */
export type FrameRequestContext = {
    frameId: number;
    requestId: string;
    requestUrl: string;
    requestType: RequestType;
};

/**
 * Tab context.
 */
export class TabContext {
    /**
     * Frames context.
     *
     * NOTE: this is temporary storage for frames data.
     * Each frame context is deleted after navigation is complete.
     * Storage is cleared on tab reload.
     * Do not use it as a data source out of request or navigation processing.
     */
    public frames = new Frames();

    /**
     * Document IDs map.
     * Used to get frame context by document ID.
     */
    public documentIdsMap = new Map<string, number>();

    /**
     * Blocked request count.
     */
    public blockedRequestCount = 0;

    /**
     * Document level rule, applied to the tab.
     */
    public mainFrameRule: NetworkRule | null = null;

    /**
     * // TODO remove.
     * @deprecated
     * This field is used in the extension, and mv2 version uses it,
     * but it is not used anymore in mv3, so it is deprecated here.
     */
    public isSyntheticTab = false;

    /**
     * Timestamp of the assistant initialization.
     *
     * Needed to avoid cosmetic rules injection into the assistant frame.
     *
     * @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1848}
     */
    public assistantInitTimestamp?: number | null = null;

    /**
     * Context constructor.
     *
     * @param info Webextension API tab data.
     * @param filteringLog Filtering Log API.
     */
    constructor(
        public info: TabInfo,
        private readonly filteringLog: FilteringLog = defaultFilteringLog,
    ) {
        this.info = info;
    }

    /**
     * Updates tab info.
     *
     * @param tabInfo Tab info.
     */
    public updateTabInfo(tabInfo: TabInfo): void {
        this.info = tabInfo;
    }

    /**
     * Updates main frame data.
     *
     * Note: this method will be called on tab reload before the first {@link browser.tabs.onUpdated} event
     * and {@link handleTabUpdate} calls.
     *
     * @param tabId Tab ID.
     * @param url Url.
     */
    public updateMainFrameData(tabId: number, url: string): void {
        this.info.url = url;
        this.info.id = tabId;
    }

    /**
     * Increments blocked requests count.
     */
    public incrementBlockedRequestCount(): void {
        this.blockedRequestCount += 1;
    }

    /**
     * Resets blocked requests count.
     */
    public resetBlockedRequestsCount(): void {
        this.blockedRequestCount = 0;
    }

    /**
     * Creates context for new tab.
     *
     * @param tab Webextension API tab data.
     *
     * @returns Tab context for new tab.
     */
    public static createNewTabContext(tab: TabInfo): TabContext {
        const tabContext = new TabContext(tab);

        // In some cases, tab is created while browser navigation processing.
        // For example: when you navigate outside the browser or create new empty tab.
        // `pendingUrl` represent url navigated to. We check it first.
        // If server returns redirect, new main frame url will be processed in WebRequestApi.
        const url = tab.pendingUrl || tab.url;

        if (url && isHttpOrWsRequest(url)) {
            tabContext.mainFrameRule = DocumentApi.matchFrame(url);

            tabContext.frames.set(MAIN_FRAME_ID, new Frame({
                tabId: tab.id,
                frameId: MAIN_FRAME_ID,
                url,
                // timestamp is 0, so that it will be recalculated in the next event
                timeStamp: 0,
            }));
        }

        return tabContext;
    }

    /**
     * Checks if passed {@link Tabs.Tab} details represent a browser tab.
     *
     * @see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/Tab#type
     * @see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/TAB_ID_NONE
     *
     * @param tab Tab details.
     * @returns True if the tab is a browser tab, otherwise returns false.
     */
    public static isBrowserTab(tab: Tabs.Tab): tab is TabInfo {
        return typeof tab.id === 'number' && tab.id !== browser.tabs.TAB_ID_NONE;
    }

    /**
     * Get frame context.
     * @param frameId Frame id.
     * @returns Frame context.
     */
    getFrameContext(frameId: number): Frame | undefined {
        return this.frames.get(frameId);
    }

    /**
     * Set frame context.
     * @param frameId Frame id.
     * @param frameContext Frame context.
     */
    setFrameContext(frameId: number, frameContext: Frame): void {
        this.frames.set(frameId, frameContext);
    }

    /**
     * Set document id.
     * @param documentId Unique identifier of the frame.
     * @param frameId Frame id.
     */
    setDocumentId(documentId: string, frameId: number): void {
        this.documentIdsMap.set(documentId, frameId);
    }

    /**
     * Get frame context by document id.
     * @param documentId Unique identifier of the frame.
     * @returns Frame context.
     */
    getFrameContextByDocumentId(documentId: string): Frame | undefined {
        const frameId = this.documentIdsMap.get(documentId);

        // frameId might be 0, do not use falsy check
        if (frameId !== undefined) {
            return this.frames.get(frameId);
        }

        return undefined;
    }

    /**
     * Deletes the frame context.
     * @param frameId The ID of the frame to delete.
     * @param maxFrameAgeMs The maximum allowed frame age in milliseconds.
     */
    deleteFrameContext(frameId: number, maxFrameAgeMs: number): void {
        // The main frame should only be deleted when the tab is closed,
        // as it may be needed for sub frames created during the page's lifetime
        // or for retrieving the main frame rule.
        if (frameId === MAIN_FRAME_ID) {
            return;
        }

        const frame = this.frames.get(frameId);
        if (!frame) {
            return;
        }

        // Do not delete frames that are not stale, as they may still be needed.
        if (frame.timeStamp && frame.timeStamp > Date.now() - maxFrameAgeMs) {
            return;
        }

        // Clear the document ID map if the frame has a document ID.
        if (frame.documentId) {
            this.documentIdsMap.delete(frame.documentId);
        }

        this.frames.delete(frameId);
    }

    /**
     * Since document frames are not removed, but rather updated, document IDs can become stale.
     * This method clears stale document IDs.
     */
    clearStaleDocumentIds(): void {
        const documentIdsLeft = this.frames.values()
            .map((frame) => frame.documentId)
            .filter(identity);

        const documentIdsLeftSet = new Set(documentIdsLeft);

        const documentIds = [...this.documentIdsMap.keys()];

        for (const documentId of documentIds) {
            if (!documentIdsLeftSet.has(documentId)) {
                this.documentIdsMap.delete(documentId);
            }
        }
    }

    /**
     * Clears stale frames.
     * @param maxFrameAgeMs The maximum allowed frame age in milliseconds.
     */
    clearStaleFrames(maxFrameAgeMs: number): void {
        const values = this.frames.values();
        for (const value of values) {
            this.deleteFrameContext(value.frameId, maxFrameAgeMs);
        }

        this.clearStaleDocumentIds();
    }
}
