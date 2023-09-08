import browser, { type ExtensionTypes, type Tabs } from 'webextension-polyfill';
import type { CosmeticResult, MatchingResult, NetworkRule } from '@adguard/tsurlfilter';

import { EventChannel } from '../../../common/utils/channels';
import type { DocumentApi } from '../document-api';
import { FrameRequestContext, TabContext, type TabInfo } from './tab-context';
import { type Frame, MAIN_FRAME_ID } from './frame';

/**
 * Request context data related to the tab's frame.
 */
export type TabFrameRequestContext = FrameRequestContext & {
    tabId: number;
};

/**
 * Tabs API. Wrapper around browser.tabs API.
 */
export class TabsApi {
    public context = new Map<number, TabContext>();

    public onCreate = new EventChannel<TabContext>();

    public onUpdate = new EventChannel<TabContext>();

    public onDelete = new EventChannel<TabContext>();

    public onActivate = new EventChannel<TabContext>();

    public onReplace = new EventChannel<TabContext>();

    /**
     * Tabs API constructor.
     *
     * @param documentApi Document API.
     */
    constructor(
        private readonly documentApi: DocumentApi,
    ) {
        this.handleTabCreate = this.handleTabCreate.bind(this);
        this.handleTabUpdate = this.handleTabUpdate.bind(this);
        this.handleTabActivate = this.handleTabActivate.bind(this);
        this.handleTabDelete = this.handleTabDelete.bind(this);
        this.handleTabReplace = this.handleTabReplace.bind(this);

        this.handleFrameRequest = this.handleFrameRequest.bind(this);
        this.handleFrameCosmeticResult = this.handleFrameCosmeticResult.bind(this);
        this.handleFrameMatchingResult = this.handleFrameMatchingResult.bind(this);

        this.getTabContext = this.getTabContext.bind(this);
        this.getTabFrameRule = this.getTabFrameRule.bind(this);
        this.getTabFrame = this.getTabFrame.bind(this);
        this.getTabMainFrame = this.getTabMainFrame.bind(this);
        this.onWindowFocusChanged = this.onWindowFocusChanged.bind(this);
    }

    /**
     * Initializes tabs API and starts listening for tab & window events.
     */
    public async start(): Promise<void> {
        browser.tabs.onCreated.addListener(this.handleTabCreate);
        browser.tabs.onRemoved.addListener(this.handleTabDelete);
        browser.tabs.onUpdated.addListener(this.handleTabUpdate);
        browser.tabs.onActivated.addListener(this.handleTabActivate);
        browser.tabs.onReplaced.addListener(this.handleTabReplace);

        browser.windows.onFocusChanged.addListener(this.onWindowFocusChanged);
    }

    /**
     * Stops listening for tab & window events and clears tabs context.
     */
    public stop(): void {
        browser.tabs.onCreated.removeListener(this.handleTabCreate);
        browser.tabs.onRemoved.removeListener(this.handleTabDelete);
        browser.tabs.onUpdated.removeListener(this.handleTabUpdate);
        browser.tabs.onActivated.removeListener(this.handleTabActivate);

        browser.windows.onFocusChanged.removeListener(this.onWindowFocusChanged);

        this.context.clear();
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
     * Records request context to the tab context.
     *
     * @param requestContext Tab's frame's request context.
     */
    public handleFrameRequest(requestContext: TabFrameRequestContext): void {
        const { tabId } = requestContext;

        const tabContext = this.context.get(tabId);

        if (!tabContext) {
            return;
        }

        tabContext.handleFrameRequest(requestContext);
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
     * Retrieves tab context by tab ID.
     *
     * @param tabId Tab ID.
     * @returns Tab context or undefined if not found.
     */
    public getTabContext(tabId: number): TabContext | undefined {
        return this.context.get(tabId);
    }

    /**
     * Checks whether the tab with the specified ID is open in incognito mode
     * or not.
     *
     * @param tabId Tab ID.
     * @returns True if the tab is open in incognito mode, and false
     * if otherwise.
     */
    public isIncognitoTab(tabId: number): boolean {
        const tabContext = this.getTabContext(tabId);

        if (!tabContext) {
            return false;
        }

        return tabContext.info.incognito;
    }

    /**
     * Increments tab context blocked request count.
     *
     * @param tabId Tab ID.
     */
    public incrementTabBlockedRequestCount(tabId: number): void {
        const tabContext = this.context.get(tabId);

        if (!tabContext) {
            return;
        }

        tabContext.incrementBlockedRequestCount();
    }

    /**
     * Updates tab's main frame rule.
     *
     * @param tabId Tab ID.
     */
    public updateTabMainFrameRule(tabId: number): void {
        const tabContext = this.context.get(tabId);

        if (!tabContext?.info.url) {
            return;
        }

        tabContext.mainFrameRule = this.documentApi.matchFrame(tabContext.info.url);
    }

    /**
     * Updates tab context data after filter engine load.
     */
    public async updateCurrentTabsMainFrameRules(): Promise<void> {
        const currentTabs = await browser.tabs.query({});

        if (!Array.isArray(currentTabs)) {
            return;
        }

        for (const tab of currentTabs) {
            if (typeof tab.id === 'number') {
                this.updateTabMainFrameRule(tab.id);
            }
        }
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

        const tabContext = TabContext.createNewTabContext(tab, this.documentApi);
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
        if (tabContext) {
            if (TabContext.isBrowserTab(tabInfo)) {
                tabContext.updateTabInfo(tabInfo);
            }
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
     * Injects script to the frame by tab id and frame id.
     *
     * @param code Script to be injected.
     * @param tabId Tab ID.
     * @param frameId Frame ID.
     */
    public static async injectScript(code: string, tabId: number, frameId?: number): Promise<void> {
        const injectDetails: ExtensionTypes.InjectDetails = {
            code,
            frameId,
            runAt: 'document_start',
            matchAboutBlank: true,
        };

        await browser.tabs.executeScript(tabId, injectDetails);
    }

    /**
     * Injects css styles to the frame by tab id and frame id.
     *
     * @param code CSS styles to be injected.
     * @param tabId Tab ID.
     * @param frameId Frame ID.
     */
    public static async injectCss(code: string, tabId: number, frameId?: number): Promise<void> {
        const injectDetails: ExtensionTypes.InjectDetails = {
            code,
            frameId,
            runAt: 'document_start',
            matchAboutBlank: true,
            cssOrigin: 'user',
        };

        await browser.tabs.insertCSS(tabId, injectDetails);
    }
}
