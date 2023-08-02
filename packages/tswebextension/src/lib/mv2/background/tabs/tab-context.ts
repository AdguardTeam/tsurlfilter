import browser from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter/es/request-type';
import type { CosmeticResult, MatchingResult, NetworkRule } from '@adguard/tsurlfilter';
import type { Tabs } from 'webextension-polyfill';

import { Frame, MAIN_FRAME_ID } from './frame';
import type { DocumentApi } from '../document-api';
import {
    type FilteringLog,
    defaultFilteringLog,
    FilteringEventType,
} from '../../../common/filtering-log';

/**
 * We need tab id in the tab information, otherwise we do not process it.
 * For example developer tools tabs.
 */
export type TabInfo = Tabs.Tab & { id: number };

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
     */
    public frames = new Map<number, Frame>();

    /**
     * Blocked request count.
     */
    public blockedRequestCount = 0;

    /**
     * Document level rule, applied to the tab.
     */
    public mainFrameRule: NetworkRule | null = null;

    /**
     * We mark these tabs as synthetic because they may not actually exist.
     */
    public isSyntheticTab = true;

    /**
     * Is document page request handled by memory cache or sw.
     */
    public isDocumentRequestCached = false;

    /**
     * Context constructor.
     *
     * @param info Webextension API tab data.
     * @param documentApi Document API.
     * @param filteringLog Filtering Log API.
     */
    constructor(
        public info: TabInfo,
        private readonly documentApi: DocumentApi,
        private readonly filteringLog: FilteringLog = defaultFilteringLog,
    ) {
        this.info = info;
    }

    /**
     * Updates tab info.
     *
     * @param changeInfo Tab change info.
     */
    public updateTabInfo(changeInfo: Tabs.OnUpdatedChangeInfoType): void {
        this.info = Object.assign(this.info, changeInfo);

        // If the tab was updated it means that it wasn't used to send requests in the background.
        this.isSyntheticTab = false;

        // Update main frame data when we navigate to another page with document request caching enabled.
        if (changeInfo.url) {
            // Get current main frame.
            const frame = this.frames.get(MAIN_FRAME_ID);

            // If main frame url is the same as request url, do nothing.
            if (frame?.url === changeInfo.url) {
                return;
            }

            // If the main frame doesn't exist or its URL is different from the request URL,
            // it means that the document request hasn't been processed by the WebRequestApi yet.
            // In this case, we mark the tab as using the cache and update its context using the tabsApi.
            this.isDocumentRequestCached = true;

            // Update main frame data.
            this.handleMainFrameRequest(changeInfo.url);
        }

        // When the cached page is reloaded, we need to manually update
        // the main frame rule for correct document-level rule processing.
        if (!changeInfo.url
            && changeInfo.status === 'loading'
            && this.isDocumentRequestCached
            && this.info.url) {
            this.handleMainFrameRequest(this.info.url);
        }
    }

    /**
     * Increments blocked requests count.
     */
    public incrementBlockedRequestCount(): void {
        this.blockedRequestCount += 1;
    }

    /**
     * Handles document or subdocument request and stores data in specified frame context.
     * If the request is a document request, will also match the main frame rule
     * and store it in the {@link mainFrameRule} property.
     * This method is called before filtering processing in WebRequest onBeforeRequest handler.
     * MatchingResult is handled in {@link handleFrameMatchingResult}.
     * CosmeticResult is handled in {@link handleFrameCosmeticResult}.
     *
     * @param requestContext Request context data.
     */
    public handleFrameRequest(requestContext: FrameRequestContext): void {
        // This method is called in the WebRequest onBeforeRequest handler.
        // It means that the request is being processed.
        this.isDocumentRequestCached = false;

        const {
            frameId,
            requestId,
            requestUrl,
            requestType,
        } = requestContext;

        if (requestType === RequestType.Document) {
            this.handleMainFrameRequest(requestUrl, requestId);
        } else {
            this.frames.set(frameId, new Frame(requestUrl, requestId));
        }
    }

    /**
     * Handles request {@link MatchingResult} from WebRequest onBeforeRequest handler
     * and stores it in specified frame context.
     *
     * @param frameId Frame id.
     * @param matchingResult Matching result.
     */
    public handleFrameMatchingResult(frameId: number, matchingResult: MatchingResult | null): void {
        const frame = this.frames.get(frameId);

        if (frame) {
            frame.matchingResult = matchingResult;
        }
    }

    /**
     * Handles frame {@link CosmeticResult} from WebRequest onBeforeRequest handler
     * and stores it in specified frame context.
     *
     * @param frameId Frame id.
     * @param cosmeticResult Cosmetic result.
     */
    public handleFrameCosmeticResult(frameId: number, cosmeticResult: CosmeticResult): void {
        const frame = this.frames.get(frameId);

        if (frame) {
            frame.cosmeticResult = cosmeticResult;
        }
    }

    /**
     * Handles document request and updates main frame context.
     *
     * Also matches document level rule and store it {@link mainFrameRule}.
     *
     * MatchingResult handles in {@link handleFrameMatchingResult}.
     * CosmeticResult handles in {@link handleFrameCosmeticResult}.
     *
     * @param requestUrl Request url.
     * @param requestId Request id.
     */
    private handleMainFrameRequest(requestUrl: string, requestId?: string): void {
        // Clear frames data on tab reload.
        this.frames.clear();

        // Set new main frame data.
        this.frames.set(MAIN_FRAME_ID, new Frame(requestUrl, requestId));

        // Calculate new main frame rule.
        this.mainFrameRule = this.documentApi.matchFrame(requestUrl);
        // Reset tab blocked count.
        this.blockedRequestCount = 0;

        // dispatch filtering log reload event
        this.filteringLog.publishEvent({
            type: FilteringEventType.TabReload,
            data: {
                tabId: this.info.id,
            },
        });
    }

    /**
     * Creates context for new tab.
     *
     * @param tab Webextension API tab data.
     * @param documentApi Document API.
     * @returns Tab context for new tab.
     */
    public static createNewTabContext(tab: TabInfo, documentApi: DocumentApi): TabContext {
        const tabContext = new TabContext(tab, documentApi);

        // In some cases, tab is created while browser navigation processing.
        // For example: when you navigate outside the browser or create new empty tab.
        // `pendingUrl` represent url navigated to. We check it first.
        // If server returns redirect, new main frame url will be processed in WebRequestApi.
        const url = tab.pendingUrl || tab.url;

        if (url) {
            tabContext.mainFrameRule = documentApi.matchFrame(url);

            tabContext.frames.set(MAIN_FRAME_ID, new Frame(url));
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
}
