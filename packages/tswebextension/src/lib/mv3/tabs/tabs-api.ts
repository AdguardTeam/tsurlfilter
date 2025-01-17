import browser, { type Tabs } from 'webextension-polyfill';
import { type NetworkRule } from '@adguard/tsurlfilter';

import { MAIN_FRAME_ID } from '../../common/constants';
import { type TabFrameRequestContextCommon } from '../../common/tabs/tabs-api';
import { EventChannel } from '../../common/utils/channels';
import { logger } from '../../common/utils/logger';
import { getDomain, isHttpOrWsRequest, isHttpRequest } from '../../common/utils/url';
import { DocumentApi } from '../background/document-api';

import { type Frame } from './frame';
import { TabContext } from './tab-context';

/**
 * Request context data related to the tab's frame.
 */
export type TabFrameRequestContextMV3 = TabFrameRequestContextCommon;

/**
 * TabsApi works with {@link browser.tabs} to record tabs' URLs - they are
 * needed for work domain-specific blocking/allowing cosmetic rules.
 */
export class TabsApi {
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

        this.getTabContext = this.getTabContext.bind(this);
        this.getTabFrameRule = this.getTabFrameRule.bind(this);
        this.getTabFrame = this.getTabFrame.bind(this);
        this.getTabMainFrame = this.getTabMainFrame.bind(this);
        this.getMainFrameUrl = this.getMainFrameUrl.bind(this);
    }

    /**
     * Starts recording the main frame URLs for the tabs.
     */
    public async start(): Promise<void> {
        browser.tabs.onCreated.addListener(this.handleTabCreate);
        browser.tabs.onRemoved.addListener(this.handleTabDelete);
        browser.tabs.onUpdated.addListener(this.handleTabUpdate);
        browser.tabs.onActivated.addListener(this.handleTabActivate);
        browser.tabs.onReplaced.addListener(this.handleTabReplace);

        // Firefox for android doesn't support windows API
        // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/windows#browser_compatibility
        if (browser.windows) {
            browser.windows.onFocusChanged.addListener(this.onWindowFocusChanged);
        }
    }

    /**
     * Stops recording the main frame URLs for the tabs.
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

        if (!tabContext) {
            return;
        }

        this.context.delete(tabId);
        this.onDelete.dispatch(tabContext);
    }

    /**
     * Updates tab context data on tab update.
     *
     * If the tab context is not found, creates a new tab context.
     *
     * @param tabId Tab ID.
     * @param changeInfo Tab change info.
     * @param tabInfo Tab info.
     */
    private handleTabUpdate(tabId: number, changeInfo: Tabs.OnUpdatedChangeInfoType, tabInfo: Tabs.Tab): void {
        if (!TabContext.isBrowserTab(tabInfo)) {
            return;
        }

        // Skip updates for non-http requests.
        if (changeInfo.url && !isHttpRequest(changeInfo.url)) {
            return;
        }

        // TODO: we can ignore some events (favicon url update etc.)
        const tabContext = this.context.get(tabId);

        if (!tabContext) {
            return;
        }

        tabContext.updateTabInfo(tabInfo);
        this.onUpdate.dispatch(tabContext);
    }

    /**
     * Dispatches tab on activated event.
     * @param tab Tab info.
     */
    private handleTabActivate(tab: Tabs.OnActivatedActiveInfoType): void {
        const tabContext = this.context.get(tab.tabId);

        if (!tabContext) {
            return;
        }

        this.onActivate.dispatch(tabContext);
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

        if (!tabContext) {
            return;
        }

        this.context.delete(removedTabId);
        this.context.set(addedTabId, tabContext);
        this.onReplace.dispatch(tabContext);
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

        if (!tabContext) {
            return;
        }

        this.onActivate.dispatch(tabContext);
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
     * Updates tab's main frame rule.
     *
     * @param tabId Tab ID.
     */
    public updateTabMainFrameRule(tabId: number): void {
        const tabContext = this.context.get(tabId);

        if (!tabContext?.info.url || !isHttpOrWsRequest(tabContext.info.url)) {
            return;
        }

        tabContext.mainFrameRule = DocumentApi.matchFrame(tabContext.info.url);
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
     * Sets main frame rule for the tab context and for the frame context.
     *
     * @param tabId Tab ID.
     * @param frameId Frame ID.
     * @param frameRule Frame rule.
     */
    public setMainFrameRule(tabId: number, frameId: number, frameRule: NetworkRule | null): void {
        const tabContext = this.getTabContext(tabId);

        if (tabContext && frameId === MAIN_FRAME_ID) {
            tabContext.mainFrameRule = frameRule;
        }

        if (frameRule) {
            this.updateFrameContext(tabId, frameId, { frameRule });
        } else {
            this.updateFrameContext(tabId, frameId, { frameRule: undefined });
        }
    }

    /**
     * Updates the frame context with additional data.
     *
     * @param tabId The ID of the tab.
     * @param frameId The ID of the frame.
     * @param partialFrameContext The details to be added to the frame context.
     *
     * @throws Error if the tab context or frame context is not found, as this should not occur at this point.
     */
    public updateFrameContext(tabId: number, frameId: number, partialFrameContext: Partial<Frame>): void {
        const tabContext = this.getTabContext(tabId);

        if (!tabContext) {
            logger.debug('At this point tab context should already exist');
            return;
        }

        const frameContext = tabContext?.getFrameContext(frameId);

        if (!frameContext) {
            logger.debug('At this point frame context should already exist');
            return;
        }

        Object.assign(frameContext, partialFrameContext);
        if (frameContext.documentId) {
            tabContext.setDocumentId(frameContext.documentId, frameId);
        }
    }

    /**
     * Sets frame context.
     * @param tabId Tab ID.
     * @param frameId Frame ID.
     * @param frameContext Frame context.
     *
     * @throws Error if the tab context is not found, as this should not occur at this point.
     */
    public setFrameContext(tabId: number, frameId: number, frameContext: Frame): void {
        const tabContext = this.getTabContext(tabId);
        if (!tabContext) {
            logger.debug('At this point tab context should already exist');
            return;
        }
        tabContext.setFrameContext(frameId, frameContext);
    }

    /**
     * Returns frame context by tabId and frameId.
     * @param tabId Tab ID.
     * @param frameId Frame ID.
     * @returns Frame context.
     */
    public getFrameContext(tabId: number, frameId: number): Frame | undefined {
        const tabContext = this.getTabContext(tabId);
        const frameContext = tabContext?.getFrameContext(frameId);
        return frameContext;
    }

    /**
     * Returns frame context by documentId.
     * @param tabId Tab ID.
     * @param documentId Unique identifier assigned to the frame on onCommited event.
     *
     * @returns Frame context.
     */
    public getByDocumentId(tabId: number, documentId: string): Frame | undefined {
        const tabContext = this.getTabContext(tabId);
        return tabContext?.getFrameContextByDocumentId(documentId);
    }

    /**
     * Deletes the frame context.
     * Also clears frames older than the specified maxFrameAgeMs.
     *
     * @param tabId The ID of the tab.
     * @param frameId The ID of the frame.
     * @param maxFrameAgeMs The maximum allowed age for frames, in milliseconds.
     */
    public deleteFrameContext(tabId: number, frameId: number, maxFrameAgeMs: number): void {
        const tabContext = this.getTabContext(tabId);
        if (!tabContext) {
            return;
        }

        tabContext.deleteFrameContext(frameId, maxFrameAgeMs);
        tabContext.clearStaleFrames(maxFrameAgeMs);
    }

    /**
     * Resets blocked requests count for the tab.
     * @param tabId Tab ID.
     */
    public resetBlockedRequestsCount(tabId: number): void {
        const tabContext = this.getTabContext(tabId);
        if (!tabContext) {
            return;
        }
        tabContext.resetBlockedRequestsCount();
    }
}

export const tabsApi = new TabsApi();
