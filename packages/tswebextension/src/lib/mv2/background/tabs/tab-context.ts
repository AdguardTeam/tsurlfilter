import browser, { type Tabs } from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter/es/request-type';
import { type CosmeticResult, type MatchingResult, type NetworkRule } from '@adguard/tsurlfilter';

import { MAIN_FRAME_ID } from '../../../common/constants';
import { defaultFilteringLog, type FilteringLog } from '../../../common/filtering-log';
import { isHttpOrWsRequest, isHttpRequest } from '../../../common/utils/url';
import { type TabInfoCommon } from '../../../common/tabs/tabs-api';
import { type DocumentApi } from '../document-api';

import { Frame } from './frame';

/**
 * Tab info for MV2.
 */
export type TabInfoMV2 = TabInfoCommon & {
    /**
     * Tab creation timestamp in milliseconds.
     */
    createdAtMs?: number,
};

/**
 * Request context data related to the frame.
 */
type FrameRequestContext = {
    frameId: number;
    requestId: string;
    requestUrl: string;
    requestType: RequestType;
    isRemoveparamRedirect?: boolean;
};

/**
 * Tab context.
 */
export class TabContext {
    /**
     * Frames context.
     * NOTE: this is temporary storage for frames data.
     * Each frame context is deleted after navigation is complete.
     * Storage is cleared on tab reload.
     * Do not use it as a data source out of request or navigation processing.
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
     * Context constructor.
     *
     * @param info Webextension API tab data.
     * @param documentApi Document API.
     * @param filteringLog Filtering Log API.
     */
    constructor(
        public info: TabInfoMV2,
        private readonly documentApi: DocumentApi,
        private readonly filteringLog: FilteringLog = defaultFilteringLog,
    ) {
        this.info = info;
        this.createdAtMs = Date.now();
    }

    /**
     * Updates tab info.
     *
     * @param changeInfo Tab change info.
     * @param tabInfo Tab info.
     */
    public updateTabInfo(changeInfo: Tabs.OnUpdatedChangeInfoType, tabInfo: TabInfoMV2): void {
        this.info = tabInfo;

        // If the tab was updated it means that it wasn't used to send requests in the background.
        this.isSyntheticTab = false;

        /**
         * When the cached page is reloaded, we need to manually update
         * the main frame rule for correct document-level rule processing.
         *
         * Prop `isDocumentRequestCached` is being set at {@link updateMainFrameData} method,
         * which is fired on main frame update before first {@link browser.tabs.onUpdated} event.
         */
        if (!changeInfo.url
            && changeInfo.status === 'loading'
            && this.isDocumentRequestCached
            && this.info.url) {
            this.handleMainFrameRequest(this.info.url);
        }
    }

    /**
     * Updates main frame data.
     *
     * Note: this method will be called on tab reload before the first {@link browser.tabs.onUpdated} event
     * and {@link handleTabUpdate} and {@link updateTabInfo} calls.
     *
     * @param tabId Tab ID.
     * @param url Url.
     */
    public updateMainFrameData(tabId: number, url: string): void {
        this.info.url = url;
        this.info.id = tabId;

        // Get current main frame.
        const frame = this.frames.get(MAIN_FRAME_ID);

        // If main frame url is the same as request url, do nothing.
        if (frame?.url === url) {
            return;
        }

        /**
         * If the main frame doesn't exist or its URL is different from the request URL,
         * we mark the tab as using the cache and update its context using the tabsApi,
         * as it means that the document request hasn't been processed by the WebRequestApi yet.
         */
        this.isDocumentRequestCached = true;

        // Update main frame data.
        this.handleMainFrameRequest(url);
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
     *
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

        // Ignore non-http requests.
        if (!isHttpRequest(requestUrl)) {
            return;
        }

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
    }

    /**
     * Creates context for new tab.
     *
     * @param tab Webextension API tab data.
     * @param documentApi Document API.
     * @returns Tab context for new tab.
     */
    public static createNewTabContext(tab: TabInfoMV2, documentApi: DocumentApi): TabContext {
        const tabContext = new TabContext(tab, documentApi);

        // In some cases, tab is created while browser navigation processing.
        // For example: when you navigate outside the browser or create new empty tab.
        // `pendingUrl` represent url navigated to. We check it first.
        // If server returns redirect, new main frame url will be processed in WebRequestApi.
        const url = tab.pendingUrl || tab.url;

        if (url && isHttpOrWsRequest(url)) {
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
    public static isBrowserTab(tab: Tabs.Tab): tab is TabInfoMV2 {
        return typeof tab.id === 'number' && tab.id !== browser.tabs.TAB_ID_NONE;
    }
}
