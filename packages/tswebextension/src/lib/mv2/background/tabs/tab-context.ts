import browser from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter/es/request-type';
import type { CosmeticResult, MatchingResult, NetworkRule } from '@adguard/tsurlfilter';
import type { Tabs } from 'webextension-polyfill';

import { Frame, MAIN_FRAME_ID } from './frame';
import { allowlistApi } from '../allowlist';
import type { RequestContext } from '../request';

/**
 * We need tab id in the tab information, otherwise we do not process it.
 * For example developer tools tabs.
 */
export type TabInfo = Tabs.Tab & { id: number };

export interface TabContextInterface {
    frames: Map<number, Frame>;

    blockedRequestCount: number;

    mainFrameRule: NetworkRule | null;

    info: TabInfo;

    isSyntheticTab: boolean;

    updateTabInfo(changeInfo: Tabs.OnUpdatedChangeInfoType): void

    incrementBlockedRequestCount(increment: number): void

    handleFrameRequest(requestContext: RequestContext): void

    handleFrameMatchingResult(frameId: number, matchingResult: MatchingResult | null): void

    handleFrameCosmeticResult(frameId: number, cosmeticResult: CosmeticResult): void
}

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
export class TabContext implements TabContextInterface {
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
     * Webextension API tab data.
     */
    public info: TabInfo;

    /**
     * We mark these tabs as synthetic because they may not actually exist.
     */
    public isSyntheticTab = true;

    /**
     * Context constructor.
     *
     * @param info Tab info.
     */
    constructor(info: TabInfo) {
        this.info = info;
    }

    /**
     * Updates tab info.
     *
     * @param changeInfo Tab change info.
     */
    public updateTabInfo(changeInfo: Tabs.OnUpdatedChangeInfoType): void {
        this.info = Object.assign(this.info, changeInfo);

        // If the tab was updated it means that it wasn't used to send requests in the background
        this.isSyntheticTab = false;
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
        const {
            frameId,
            requestId,
            requestUrl,
            requestType,
        } = requestContext;

        if (requestType === RequestType.Document) {
            this.handleMainFrameRequest(requestContext);
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
     * Handles document request and stores data in main frame context.
     * Also matches document level rule and store it {@link mainFrameRule}.
     * This method is called before filtering processing in WebRequest onBeforeRequest handler.
     *
     * MatchingResult handles in {@link handleFrameMatchingResult}.
     * CosmeticResult handles in {@link handleFrameCosmeticResult}.
     *
     * @param requestContext Request context data.
     */
    private handleMainFrameRequest(requestContext: FrameRequestContext): void {
        const {
            requestUrl,
            requestId,
        } = requestContext;

        // clear frames data on tab reload
        this.frames.clear();

        // set new main frame data
        this.frames.set(MAIN_FRAME_ID, new Frame(requestUrl, requestId));

        // calculate new main frame rule
        this.mainFrameRule = allowlistApi.matchFrame(requestUrl);
        // reset tab blocked count
        this.blockedRequestCount = 0;
    }

    /**
     * Creates context for new tab.
     *
     * @param tab Tab info.
     * @returns Tab context for new tab.
     */
    public static createNewTabContext(tab: TabInfo): TabContext {
        const tabContext = new TabContext(tab);

        /**
         * In some cases, tab is created while browser navigation processing.
         * For example: when you navigate outside the browser or create new empty tab.
         * `pendingUrl` represent url navigated to.
         * We check it first.
         * If server returns redirect, new main frame url will be processed in WebRequestApi.
         */
        const url = tab.pendingUrl || tab.url;

        if (url) {
            tabContext.mainFrameRule = allowlistApi.matchFrame(url);

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
