import browser, { type Tabs } from 'webextension-polyfill';
import { identity } from 'lodash-es';
import { type NetworkRule } from '@adguard/tsurlfilter';

import { MAIN_FRAME_ID } from '../constants';
import { defaultFilteringLog, type FilteringLog } from '../filtering-log';

import { type FrameCommon } from './frame';
import { Frames } from './frames';
import { type TabInfo } from './tabs-api';

/**
 * Tab context common class.
 */
export class TabContextCommon<F extends FrameCommon> {
    /**
     * Frames context.
     *
     * NOTE: this is temporary storage for frames data.
     * Each frame context is deleted after navigation is complete.
     * Storage is cleared on tab reload.
     * Do not use it as a data source out of request or navigation processing.
     */
    public frames = new Frames<F>();

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

    // TODO: remove later.
    /**
     * @deprecated
     * This field is used in the extension, and mv2 version uses it,
     * but it is not used anymore in mv3, so it is deprecated here.
     *
     * We mark these tabs as synthetic because they may not actually exist.
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
     * Tab creation timestamp in milliseconds.
     */
    public readonly createdAtMs: number;

    /**
     * Tab context constructor.
     *
     * @param info Tab info.
     * @param filteringLog Filtering log.
     */
    constructor(
        public info: TabInfo,
        protected readonly filteringLog: FilteringLog = defaultFilteringLog,
    ) {
        this.createdAtMs = Date.now();
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
     * Checks if the tab hosts a content by checking its ID.
     * Non-content tabs can be PWA apps and devtools windows.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/TAB_ID_NONE}.
     *
     * @param tabId Tab ID.
     *
     * @returns True if the tab is a content tab.
     */
    public static isTabHostingContent(tabId: number): boolean {
        return tabId !== browser.tabs.TAB_ID_NONE;
    }

    /**
     * Checks if passed {@link Tabs.Tab} details represent a browser tab.
     *
     * @see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/Tab#type
     * @see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/TAB_ID_NONE
     *
     * @param tab Tab details.
     *
     * @returns True if the tab is a browser tab, otherwise returns false.
     */
    public static isBrowserTab(tab: Tabs.Tab): tab is TabInfo {
        return typeof tab.id === 'number' && TabContextCommon.isTabHostingContent(tab.id);
    }

    /**
     * Get frame context.
     *
     * @param frameId Frame id.
     *
     * @returns Frame context.
     */
    public getFrameContext(frameId: number): F | undefined {
        return this.frames.get(frameId);
    }

    /**
     * Set frame context.
     *
     * @param frameId Frame id.
     * @param frameContext Frame context.
     */
    public setFrameContext(frameId: number, frameContext: F): void {
        this.frames.set(frameId, frameContext);
    }

    /**
     * Set document id.
     *
     * @param documentId Unique identifier of the frame.
     * @param frameId Frame id.
     */
    public setDocumentId(documentId: string, frameId: number): void {
        this.documentIdsMap.set(documentId, frameId);
    }

    /**
     * Get frame context by document id.
     *
     * @param documentId Unique identifier of the frame.
     *
     * @returns Frame context.
     */
    public getFrameContextByDocumentId(documentId: string): F | undefined {
        const frameId = this.documentIdsMap.get(documentId);

        // frameId might be 0, do not use falsy check
        if (frameId !== undefined) {
            return this.frames.get(frameId);
        }

        return undefined;
    }

    /**
     * Deletes the frame context.
     *
     * @param frameId The ID of the frame to delete.
     * @param maxFrameAgeMs The maximum allowed frame age in milliseconds.
     */
    public deleteFrameContext(frameId: number, maxFrameAgeMs: number): void {
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
    private clearStaleDocumentIds(): void {
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
     *
     * @param maxFrameAgeMs The maximum allowed frame age in milliseconds.
     */
    public clearStaleFrames(maxFrameAgeMs: number): void {
        const values = this.frames.values();
        for (const value of values) {
            this.deleteFrameContext(value.frameId, maxFrameAgeMs);
        }

        this.clearStaleDocumentIds();
    }
}
