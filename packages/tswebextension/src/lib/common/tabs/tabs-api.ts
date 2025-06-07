import browser, { type Tabs } from 'webextension-polyfill';
import { type RequestType, type NetworkRule } from '@adguard/tsurlfilter';

import { type DocumentApi } from '../../mv2/background/document-api';
import { MAIN_FRAME_ID, NO_PARENT_FRAME_ID } from '../constants';
import { EventChannel } from '../utils/channels';
import { logger } from '../utils/logger';
import { getDomain } from '../utils/url';

import { type FrameCommon } from './frame';
import { TabContextCommon } from './tab-context';

/**
 * Tab information with defined tab id.
 *
 * We need tab id in the tab information, otherwise we do not process it.
 * For example developer tools tabs.
 */
export type TabInfo = Tabs.Tab & {
    /**
     * Tab id.
     */
    id: number;
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

/**
 * Tabs API common class.
 */
export abstract class TabsApiCommon<F extends FrameCommon, T extends TabContextCommon<F>> {
    /**
     * Keys of the tab changed info.
     *
     * See {@link Tabs.OnUpdatedChangeInfoType}.
     */
    private static readonly TAB_CHANGED_INFO_KEYS: Array<keyof Tabs.OnUpdatedChangeInfoType> = [
        'attention',
        'audible',
        'autoDiscardable',
        'discarded',
        'favIconUrl',
        'hidden',
        'isArticle',
        'mutedInfo',
        'pinned',
        'sharingState',
        'status',
        'title',
        'url',
    ];

    public context = new Map<number, T>();

    public onCreate = new EventChannel<T>();

    public onUpdate = new EventChannel<T>();

    public onDelete = new EventChannel<T>();

    public onActivate = new EventChannel<T>();

    public onReplace = new EventChannel<T>();

    /**
     * Tabs API constructor.
     *
     * @param documentApi Optional, Document API instance. Needed for MV2.
     */
    constructor(protected readonly documentApi?: DocumentApi) {
        this.handleTabCreate = this.handleTabCreate.bind(this);
        this.handleTabUpdate = this.handleTabUpdate.bind(this);
        this.handleTabActivate = this.handleTabActivate.bind(this);
        this.handleTabReplace = this.handleTabReplace.bind(this);
        this.handleTabDelete = this.handleTabDelete.bind(this);
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
     *
     * @returns Created tab context.
     */
    protected abstract createTabContext(tab: TabInfo): T;

    /**
     * Creates a new tab context on tab creation.
     *
     * @param tab Tab info.
     * @param tab.id Tab id.
     *
     * @returns Created tab context, or null if tab is not browser tab.
     */
    protected handleTabCreate(tab: Tabs.Tab): T | null {
        if (!TabContextCommon.isBrowserTab(tab)) {
            return null;
        }

        /**
         * If tab context already created at this point, it means that
         * context has been created by `createTabContextIfNotExists` method.
         * Instead of re-creating the context and firing `onCreate` event,
         * we just update the existing tab info and fire `onUpdate` event.
         */
        let tabContext = this.context.get(tab.id);
        if (tabContext && tabContext.isSyntheticTab) {
            /**
             * We previously in `createTabContextIfNotExists` marked
             * tab context as synthetic, because Tabs API `onCreated`
             * event is fired, this context no longer synthetic.
             */
            tabContext.isSyntheticTab = false;

            const changedInfo = this.getTabChangedInfo(tabContext, tab);
            this.handleTabUpdate(tab.id, changedInfo, tab);
        } else {
            tabContext = this.createTabContext(tab);
            this.context.set(tab.id, tabContext);
            this.onCreate.dispatch(tabContext);
        }

        return tabContext;
    }

    /**
     * Creates and adds a new tab context if it does not exist in the context map,
     * in case if Tabs API does not fire `onCreated` event before point of call.
     *
     * The cases are:
     * - The right side of split screen in Edge does not fire any Tabs API events (see issue link below).
     * - `onCreated` might be fired later than `onBeforeNavigate` and `onBeforeRequest`,
     *   where we precalculate cosmetics and blocking rules.
     *
     * @see {@link https://github.com/microsoft/MicrosoftEdge-Extensions/issues/296 | Edge Split Screen Issue}
     *
     * @param tabId Tab ID.
     * @param url Tab URL.
     *
     * @todo Add removal logic for stale tab contexts. It potentially bloats memory
     *       in case if Tabs API does not fire the `onRemoved` event.
     * @todo Currently, Edge does not fire `onUpdated` and `onActivated` events
     *       for the right side of split screen. When this issue is fixed (see issue link above),
     *       we need to make sure that the tab context is updated and tabs are activated correctly.
     */
    public createTabContextIfNotExists(tabId: number, url: string): void {
        // Do nothing if the tab context already exists.
        if (this.context.has(tabId)) {
            return;
        }

        /**
         * We need to create a synthetic tab info object with minimal properties,
         * to be able to create a tab context. At later point when `onCreated` will be
         * fired, we will update the tab context with full tab info in {@link handleTabCreate}.
         *
         * NOTE: This method doesn't uses `tabs.get(tabId)` to retrieve full tab info,
         * because it requires method to be async, and it is used inside
         * of `webRequest.onBeforeRequest` and `webNavigation.onBeforeNavigate` events
         * which needs to be sync and requires immediate handling. Full tab info
         * will be needed for Filtering Log to show the tab title, etc.
         */
        const syntheticTab: Tabs.Tab = {
            id: tabId,
            url,

            // If we are creating tab manually it means that `onCreated`
            // event was not fired, so we don't know the tab index yet.
            index: -1,

            // This properties required, so we default all of them to `false`.
            highlighted: false,
            active: false,
            pinned: false,
            incognito: false,
        };

        const syntheticTabContext = this.handleTabCreate(syntheticTab);

        /**
         * Mark the tab context as synthetic.
         * This is needed at later point to determine if the tab
         * context was created manually or from Tabs API event.
         */
        if (syntheticTabContext) {
            syntheticTabContext.isSyntheticTab = true;
        }
    }

    /**
     * Returns tab changed info.
     *
     * This method is used to compare the old tab info with the new tab info
     * in case if `onCreated` is fired on synthetic tab context and we need to
     * actualize the tab info by emulating native `onUpdated` event.
     *
     * @param tabContext Existing tab context.
     * @param newTabInfo Tab info to be updated.
     *
     * @returns Tab changed info.
     */
    // eslint-disable-next-line class-methods-use-this
    private getTabChangedInfo(tabContext: T, newTabInfo: Tabs.Tab): Tabs.OnUpdatedChangeInfoType {
        const oldTabInfo = tabContext.info;
        const changedInfo: Tabs.OnUpdatedChangeInfoType = {};

        for (const key of TabsApiCommon.TAB_CHANGED_INFO_KEYS) {
            if (oldTabInfo[key] !== newTabInfo[key]) {
                // @ts-expect-error - Tab info keys always matches with changed info keys
                changedInfo[key] = newTabInfo[key];
            }
        }

        return changedInfo;
    }

    /**
     * Updates tab context data on tab update.
     *
     * If the tab context is not found, creates a new tab context.
     *
     * If the tab context is not found, creates a new tab context.
     *
     * @param tabId Tab ID.
     * @param changeInfo Tab change info.
     * @param tabInfo Tab info.
     */
    protected handleTabUpdate(tabId: number, changeInfo: Tabs.OnUpdatedChangeInfoType, tabInfo: Tabs.Tab): void {
        if (!TabContextCommon.isBrowserTab(tabInfo)) {
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
     *
     * @param tab Tab info.
     */
    protected handleTabActivate(tab: Tabs.OnActivatedActiveInfoType): void {
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
     * @param addedTabId Id of the new tab context moved to.
     * @param removedTabId Id of removed tab.
     */
    protected handleTabReplace(addedTabId: number, removedTabId: number): void {
        const tabContext = this.context.get(removedTabId);

        if (!tabContext) {
            return;
        }

        this.context.delete(removedTabId);
        this.context.set(addedTabId, tabContext);
        this.onReplace.dispatch(tabContext);
    }

    /**
     * Removes tab context by tab ID.
     *
     * @param tabId Tab ID.
     */
    protected handleTabDelete(tabId: number): void {
        const tabContext = this.context.get(tabId);

        if (!tabContext) {
            return;
        }

        this.context.delete(tabId);
        this.onDelete.dispatch(tabContext);
    }

    /**
     * Called when focus state of window changed.
     *
     * @param windowId Window ID.
     */
    protected async onWindowFocusChanged(windowId: number): Promise<void> {
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
     * Retrieves tab context by tab ID.
     *
     * @param tabId Tab ID.
     *
     * @returns Tab context or undefined if not found.
     */
    public getTabContext(tabId: number): T | undefined {
        return this.context.get(tabId);
    }

    /**
     * Retrieves frame rule for the tab context.
     *
     * @param tabId Tab ID.
     *
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
     *
     * @returns Frame data or null if not found.
     */
    public getTabFrame(tabId: number, frameId: number): F | null {
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
     *
     * @returns Frame data or null if not found.
     */
    public getTabMainFrame(tabId: number): F | null {
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
     * Checks if the frame is a document-level frame by checking its parent frame ID.
     *
     * @param parentFrameId Parent frame ID.
     *
     * @returns True if the parent frame is a document-level frame.
     */
    public static isDocumentLevelFrame(parentFrameId: number): boolean {
        return parentFrameId === NO_PARENT_FRAME_ID;
    }

    /**
     * Checks whether the tab with the specified ID is open
     * in incognito mode or not.
     *
     * @param tabId Tab ID.
     *
     * @returns True if the tab is open in incognito mode, false otherwise.
     */
    public isIncognitoTab(tabId: number): boolean {
        const tabContext = this.getTabContext(tabId);

        if (!tabContext) {
            return false;
        }

        return tabContext.info.incognito;
    }

    /**
     * Checks whether the tab with the specified ID
     * can display the extension page or not.
     *
     * The tab is not allowed to display the extension page if:
     * - Tab is in incognito mode.
     * - Synthetic tab, because we created it manually,
     *   we can't know for sure if tab is in incognito or not,
     *   so by default extension page is not allowed in those tabs.
     *
     * @param tabId Tab ID.
     *
     * @returns True if extension page is not allowed for tab, false otherwise.
     */
    public canShowExtensionPageInTab(tabId: number): boolean {
        const tabContext = this.getTabContext(tabId);

        if (!tabContext) {
            return false;
        }

        if (tabContext.isSyntheticTab) {
            return true;
        }

        return tabContext.info.incognito;
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
        if (
            !tabUrl
            || !referrerUrl
            || getDomain(tabUrl) !== getDomain(referrerUrl)
        ) {
            return;
        }

        tabContext.incrementBlockedRequestCount();
    }

    /**
     * Resets blocked requests count for the tab.
     *
     * @param tabId Tab ID.
     */
    public resetBlockedRequestsCount(tabId: number): void {
        const tabContext = this.getTabContext(tabId);
        if (!tabContext) {
            return;
        }
        tabContext.resetBlockedRequestsCount();
    }

    /**
     * Sets a current timestamp as `assistantInitTimestamp` of the tab context.
     *
     * Needed to determine later if a newly created frame is an assistant frame.
     *
     * @param tabId Tab id.
     */
    public setAssistantInitTimestamp(tabId: number): void {
        const tabContext = this.context.get(tabId);

        if (!tabContext) {
            return;
        }

        tabContext.assistantInitTimestamp = Date.now();
    }

    /**
     * Resets tab context's `assistantInitTimestamp` to null.
     *
     * @param tabId Tab id.
     */
    public resetAssistantInitTimestamp(tabId: number): void {
        const tabContext = this.context.get(tabId);

        if (!tabContext) {
            return;
        }

        tabContext.assistantInitTimestamp = null;
    }

    /**
     * Checks if the tab context is expected to exist.
     *
     * This method is needed to identify cases when tab context does not exist
     * when it should exist, for example when tab context is not created or created too late.
     *
     * @param tabId Tab ID to check.
     * @param url Tab URL to check.
     *
     * @returns True if tab context is expected to exist, false otherwise.
     *
     * @todo Remove this method when issue above will be fixed.
     */
    private static checkIfTabContextExpectedToExist(tabId: number, url?: string): boolean {
        // Early exit - if tab already does not hosts content,
        // we don't need to perform any additional checks.
        if (!TabContextCommon.isTabHostingContent(tabId)) {
            return false;
        }

        // List of URLs we shouldn't log for about expected tab context.
        const doNotLogForUrls = [
            'devtools://', // Chrome DevTools
            'chrome-extension://', // Chrome extension
            'https://devtools.azureedge.net', // Edge DevTools
        ];

        // We skip only if we are sure that URL is not empty and starts with one of the forbidden URLs.
        if (url && doNotLogForUrls.some((forbiddenUrl) => url.startsWith(forbiddenUrl))) {
            return false;
        }

        return true;
    }

    /**
     * Sets frame context.
     *
     * @param tabId Tab ID.
     * @param frameId Frame ID.
     * @param frameContext Frame context.
     *
     * @throws Error if the tab context is not found, as this should not occur at this point.
     */
    public setFrameContext(
        tabId: number,
        frameId: number,
        frameContext: F,
    ): void {
        const tabContext = this.getTabContext(tabId);
        if (!tabContext) {
            if (TabsApiCommon.checkIfTabContextExpectedToExist(tabId, frameContext.url)) {
                logger.debug(`[tsweb.TabsApiCommon.setFrameContext]: at this point tab#${tabId} context should already exist`);
            }
            return;
        }
        tabContext.setFrameContext(frameId, frameContext);
    }

    /**
     * Returns frame context by tabId and frameId.
     *
     * @param tabId Tab ID.
     * @param frameId Frame ID.
     *
     * @returns Frame context.
     */
    public getFrameContext(tabId: number, frameId: number): F | undefined {
        const tabContext = this.getTabContext(tabId);
        const frameContext = tabContext?.getFrameContext(frameId);
        return frameContext;
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
    public updateFrameContext(
        tabId: number,
        frameId: number,
        partialFrameContext: Partial<F>,
    ): void {
        const tabContext = this.getTabContext(tabId);

        if (!tabContext) {
            if (TabsApiCommon.checkIfTabContextExpectedToExist(tabId, partialFrameContext.url)) {
                logger.debug(`[tsweb.TabsApiCommon.updateFrameContext]: at this point tab#${tabId} context should already exist`);
            }
            return;
        }

        const frameContext = tabContext?.getFrameContext(frameId);

        if (!frameContext) {
            logger.debug(`[tsweb.TabsApiCommon.updateFrameContext]: at this point frame#${frameId} context should already exist`);
            return;
        }

        Object.assign(frameContext, partialFrameContext);
        if (frameContext.documentId) {
            tabContext.setDocumentId(frameContext.documentId, frameId);
        }
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
     * Returns frame context by documentId.
     *
     * @param tabId Tab ID.
     * @param documentId Unique identifier assigned to the frame on onCommitted event.
     *
     * @returns Frame context.
     */
    public getByDocumentId(tabId: number, documentId: string): F | undefined {
        const tabContext = this.getTabContext(tabId);
        return tabContext?.getFrameContextByDocumentId(documentId);
    }

    /**
     * Sets main frame rule for the tab context and for the frame context.
     *
     * @param tabId Tab ID.
     * @param frameId Frame ID.
     * @param frameRule Frame rule.
     */
    public setMainFrameRule(
        tabId: number,
        frameId: number,
        frameRule: NetworkRule | null,
    ): void {
        const tabContext = this.getTabContext(tabId);

        if (tabContext && frameId === MAIN_FRAME_ID) {
            tabContext.mainFrameRule = frameRule;
        }

        if (frameRule) {
            this.updateFrameContext(tabId, frameId, { frameRule } as Partial<F>);
        } else {
            this.updateFrameContext(tabId, frameId, { frameRule: undefined } as Partial<F>);
        }
    }
}
