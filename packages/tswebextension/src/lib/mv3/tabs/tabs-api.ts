import browser, { type Tabs } from 'webextension-polyfill';
import type { CosmeticResult, MatchingResult, NetworkRule } from '@adguard/tsurlfilter';

import { EventChannel, getDomain, isHttpRequest } from '../../common';
import { type FrameRequestContext, TabContext } from './tab-context';
import { type Frame, MAIN_FRAME_ID } from './frame';

/**
 * Request context data related to the tab's frame.
 */
export type TabFrameRequestContext = FrameRequestContext & {
    tabId: number;
};

/**
 * TabsApi works with {@link browser.tabs} to record tabs URL's - they needed
 * for work domain-specific blocking/allowing cosmetic rules.
 *
 * FIXME: Do not forget about tests.
 */
export class TabsApi {
    // FIXME: Use persistent storage due to recreation of service worker.
    public context = new Map<number, TabContext>();

    public onCreate = new EventChannel<TabContext>();

    public onUpdate = new EventChannel<TabContext>();

    public onDelete = new EventChannel<TabContext>();

    public onActivate = new EventChannel<TabContext>();

    public onReplace = new EventChannel<TabContext>();

    /**
     * Creates new {@link TabsApi} with binding context.
     */
    constructor() {
        this.handleTabCreate = this.handleTabCreate.bind(this);
        this.handleTabUpdate = this.handleTabUpdate.bind(this);
        this.handleTabActivate = this.handleTabActivate.bind(this);
        this.handleTabDelete = this.handleTabDelete.bind(this);
        this.handleTabReplace = this.handleTabReplace.bind(this);
        this.onWindowFocusChanged = this.onWindowFocusChanged.bind(this);

        this.handleFrameRequest = this.handleFrameRequest.bind(this);
        this.handleFrameCosmeticResult = this.handleFrameCosmeticResult.bind(this);
        this.handleFrameMatchingResult = this.handleFrameMatchingResult.bind(this);

        this.getTabContext = this.getTabContext.bind(this);
        this.getTabFrameRule = this.getTabFrameRule.bind(this);
        this.getTabFrame = this.getTabFrame.bind(this);
        this.getTabMainFrame = this.getTabMainFrame.bind(this);
        this.getMainFrameUrl = this.getMainFrameUrl.bind(this);
    }

    /**
     * Starts recording the main frame URL's for the tabs.
     */
    public async start(): Promise<void> {
        // FIXME: Check usage
        // await this.createCurrentTabsContext();

        browser.tabs.onCreated.addListener(this.handleTabCreate);
        browser.tabs.onRemoved.addListener(this.handleTabDelete);
        browser.tabs.onUpdated.addListener(this.handleTabUpdate);
        browser.tabs.onActivated.addListener(this.handleTabActivate);
        browser.tabs.onReplaced.addListener(this.handleTabReplace);

        // Firefox for android doesn't support windows API
        // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/windows#chrome_compatibility
        if (browser.windows) {
            browser.windows.onFocusChanged.addListener(this.onWindowFocusChanged);
        }
    }

    /**
     * Stops recording the main frame URL's for the tabs.
     */
    public stop(): void {
        browser.tabs.onCreated.removeListener(this.handleTabCreate);
        browser.tabs.onRemoved.removeListener(this.handleTabDelete);
        browser.tabs.onUpdated.removeListener(this.handleTabUpdate);
        browser.tabs.onActivated.removeListener(this.handleTabActivate);
        browser.tabs.onReplaced.removeListener(this.handleTabReplace);

        // Firefox for android doesn't support windows API
        if (browser.windows) {
            browser.windows.onFocusChanged.removeListener(this.onWindowFocusChanged);
        }

        this.context.clear();
    }

    /**
     * Creates a new tab context.
     *
     * @param tab Tab info.
     * @param tab.id Tab id.
     *
     * @returns Created tab context, or null if tab is not browser tab.
     */
    private handleTabCreate(tab: Tabs.Tab): TabContext | null {
        if (!TabContext.isBrowserTab(tab)) {
            return null;
        }

        // FIXME: Problem with creating url
        // Error in event handler: TypeError: Invalid request url: chrome://newtab/
        //     at new Request (chrome-extension://ijilocolkkdcgpgcbbmcinaenmmpinmk/pages/background.js:40027:19)
        //     at Engine.matchFrame (chrome-extension://ijilocolkkdcgpgcbbmcinaenmmpinmk/pages/background.js:40337:29)
        //     at EngineApi.matchFrame (chrome-extension://ijilocolkkdcgpgcbbmcinaenmmpinmk/pages/background.js:164339:28)
        //     at TabContext.createNewTabContext (chrome-extension://ijilocolkkdcgpgcbbmcinaenmmpinmk/pages/background.js:165005:50)
        //     at TabsApi.handleTabCreate (chrome-extension://ijilocolkkdcgpgcbbmcinaenmmpinmk/pages/background.js:165110:39)
        // 21:18:46.292 background.js:115200
        const tabContext = TabContext.createNewTabContext(tab);
        this.context.set(tab.id, tabContext);
        this.onCreate.dispatch(tabContext);
        return tabContext;
    }

    /**
     * Removes tab context by tab ID.
     *
     * @param tabId Tab ID.
     */
    private handleTabDelete(tabId: number): void {
        const tabContext = this.context.get(tabId);
        if (tabContext) {
            this.context.delete(tabId);
            this.onDelete.dispatch(tabContext);
        }
    }

    /**
     * Updates tab context data on tab update.
     *
     * @param tabId Tab ID.
     * @param changeInfo Tab change info.
     * @param tabInfo Tab info.
     */
    private handleTabUpdate(tabId: number, changeInfo: Tabs.OnUpdatedChangeInfoType, tabInfo: Tabs.Tab): void {
        // TODO: we can ignore some events (favicon url update etc.)
        const tabContext = this.context.get(tabId);
        if (tabContext && TabContext.isBrowserTab(tabInfo)) {
            if (changeInfo.url && !isHttpRequest(changeInfo.url)) {
                return;
            }
            tabContext.updateTabInfo(changeInfo, tabInfo);
            this.onUpdate.dispatch(tabContext);
        }
    }

    /**
     * Dispatches tab on activated event.
     *
     * @param info Tab activated info.
     * @param info.tabId Tab ID.
     */
    private handleTabActivate({ tabId }: Tabs.OnActivatedActiveInfoType): void {
        const tabContext = this.context.get(tabId);

        if (tabContext) {
            this.onActivate.dispatch(tabContext);
        }
    }

    /**
     * The browser tab may be replaced by another when the discarded tab wakes up.
     * We handle this case on {@link browser.tabs.onReplaced} event.
     * It fires before the tab details are updated,
     * so we just move the existing tab context to the new key.
     *
     * @param addedTabId - Id of the new tab context moved to.
     * @param removedTabId - Id of removed tab.
     */
    private handleTabReplace(addedTabId: number, removedTabId: number): void {
        const tabContext = this.context.get(removedTabId);

        if (tabContext) {
            this.context.delete(removedTabId);
            this.context.set(addedTabId, tabContext);
            this.onReplace.dispatch(tabContext);
        }
    }

    /**
     * Uses {@link browser.webNavigation.onBeforeNavigate} event data
     * to update tab context data in conjunction with {@link handleTabUpdate}.
     *
     * Note: it is being specifically called at onBeforeNavigate
     * to handle initial tab update before {@link browser.tab.onUpdate} and {@link handleTabUpdate}.
     *
     * @param tabId Tab ID.
     * @param url Url.
     */
    public handleTabNavigation(tabId: number, url: string): void {
        const tabContext = this.context.get(tabId);
        if (!tabContext) {
            return;
        }

        tabContext.updateMainFrameData(tabId, url);
    }

    /**
     * Called when focus state of window changed.
     *
     * @param windowId Window ID.
     */
    private async onWindowFocusChanged(windowId: number): Promise<void> {
        // If all browser windows have lost focus.
        if (windowId === browser.windows.WINDOW_ID_NONE) {
            return;
        }

        const [activeTab] = await browser.tabs.query({
            active: true,
            windowId,
        });

        if (!activeTab || !activeTab.id) {
            return;
        }

        const tabContext = this.context.get(activeTab.id);

        if (tabContext) {
            this.onActivate.dispatch(tabContext);
        }
    }

    /**
     * Retrieves frame data for the frame in the tab context.
     *
     * @param tabId Tab ID.
     * @param frameId Frame ID.
     * @returns Frame data or null if not found.
     */
    public getTabFrame(tabId: number, frameId: number): Frame | null {
        const tabContext = this.context.get(tabId);

        if (!tabContext) {
            return null;
        }

        const frame = tabContext.frames.get(frameId);

        if (!frame) {
            return null;
        }

        return frame;
    }

    /**
     * Retrieves main frame data for the tab context.
     *
     * @param tabId Tab ID.
     * @returns Frame data or null if not found.
     */
    public getTabMainFrame(tabId: number): Frame | null {
        return this.getTabFrame(tabId, MAIN_FRAME_ID);
    }

    /**
     * Returns main frame URL for provided tab ID.
     *
     * @param tabId Tab ID.
     *
     * @returns Main frame URL for provided tab ID.
     */
    public getMainFrameUrl(tabId: number): string | undefined {
        return this.getTabMainFrame(tabId)?.url;
    }

    /**
     * Retrieves tab context by tab ID.
     *
     * @param tabId Tab ID.
     * @returns Tab context or undefined if not found.
     */
    public getTabContext(tabId: number): TabContext | undefined {
        return this.context.get(tabId);
    }

    /**
     * Retrieves frame rule for the tab context.
     *
     * @param tabId Tab ID.
     * @returns Frame rule or null if not found.
     */
    public getTabFrameRule(tabId: number): NetworkRule | null {
        const tabContext = this.context.get(tabId);

        if (!tabContext) {
            return null;
        }

        return tabContext.mainFrameRule;
    }

    /**
     * Checks if tab is a new tab.
     *
     * TODO: Change in AG-22715: if the lifetime of the tab is less than N
     * seconds (for example 5 seconds), then it is a popup and we close it. If
     * the opposite is true, then we block it with a stub.
     *
     * @param tabId Tab ID.
     * @returns True if tab is a new tab.
     */
    public isNewPopupTab(tabId: number): boolean {
        const tab = this.context.get(tabId);

        if (!tab) {
            return false;
        }

        const url = tab.info?.url;

        return url === undefined
            || url === ''
            || url === 'about:blank';
    }

    /**
     * Increments tab context blocked request count.
     *
     * @param tabId Tab ID.
     * @param referrerUrl Request initiator url.
     */
    public incrementTabBlockedRequestCount(tabId: number, referrerUrl: string): void {
        const tabContext = this.context.get(tabId);

        if (!tabContext) {
            return;
        }

        const tabUrl = tabContext.info?.url;
        /**
         * Only increment count for requests that are initiated from the same domain as the tab.
         *
         * This prevents count 'leaks' when moving between main frames due to async nature of
         * {@link browser.webRequest.onBeforeRequest} and {@link browser.tabs.onUpdated} events.
         */
        if (!tabUrl || !referrerUrl || getDomain(tabUrl) !== getDomain(referrerUrl)) {
            return;
        }

        tabContext.incrementBlockedRequestCount();
    }

    /**
     * Records request context to the tab context.
     *
     * @param requestContext Tab's frame's request context.
     * @param isRemoveparamRedirect Indicates whether the request is a $removeparam redirect.
     */
    public handleFrameRequest(requestContext: TabFrameRequestContext, isRemoveparamRedirect = false): void {
        const { tabId } = requestContext;

        const tabContext = this.context.get(tabId);

        if (!tabContext) {
            return;
        }

        tabContext.handleFrameRequest(requestContext, isRemoveparamRedirect);
    }

    /**
     * Records frame cosmetic result to the tab context.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param cosmeticResult Frame {@link CosmeticResult}.
     */
    public handleFrameCosmeticResult(
        tabId: number,
        frameId: number,
        cosmeticResult: CosmeticResult,
    ): void {
        const tabContext = this.context.get(tabId);

        if (!tabContext) {
            return;
        }

        tabContext.handleFrameCosmeticResult(frameId, cosmeticResult);
    }

    /**
     * Records frame matching result to the tab context.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param matchingResult Frame {@link MatchingResult}.
     */
    public handleFrameMatchingResult(
        tabId: number,
        frameId: number,
        matchingResult: MatchingResult,
    ): void {
        const tabContext = this.context.get(tabId);

        if (!tabContext) {
            return;
        }

        tabContext.handleFrameMatchingResult(frameId, matchingResult);
    }

    /**
     * Returns current active tab.
     *
     * @returns Current active tab.
     */
    static getActiveTab = (): Promise<chrome.tabs.Tab> => {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const error = browser.runtime.lastError;
                if (error) {
                    reject(error);
                }

                const [tab] = tabs;
                resolve(tab);
            });
        });
    };
}

export const tabsApi = new TabsApi();
