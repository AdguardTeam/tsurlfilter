import { NetworkRule, RequestType, logger } from '@adguard/tsurlfilter';
import browser, { ExtensionTypes, Tabs } from 'webextension-polyfill';

import { TabContext } from './tab-context';
import { Frame } from './frame';
import { EventChannel, EventChannelInterface } from '../../../common';
import { RequestContext } from '../request';

export interface TabsApiInterface {
    start: () => Promise<void>
    stop: () => void

    getTabContext: (tabId: number) => TabContext | undefined

    setTabFrameRule: (tabId: number, frameRule: NetworkRule) => void
    getTabFrameRule: (tabId: number) => NetworkRule | null

    setTabFrame: (tabId: number, frameId: number, frameData: Frame) => void
    getTabFrame: (tabId: number, frameId: number) => Frame | null
    getTabMainFrame: (tabId: number) => Frame | null
    recordFrameRequest: (requestContext: RequestContext) => void

    onCreate: EventChannelInterface<TabContext>
    onUpdate: EventChannelInterface<TabContext>
    onDelete: EventChannelInterface<TabContext>
}

/**
 * Tabs API. Wrapper around browser.tabs API.
 */
export class TabsApi implements TabsApiInterface {
    // TODO: use global config context
    private verbose = false;

    private context = new Map<number, TabContext>();

    public onCreate = new EventChannel<TabContext>();

    public onUpdate = new EventChannel<TabContext>();

    public onDelete = new EventChannel<TabContext>();

    public onActivated = new EventChannel<TabContext>();

    /**
     * Tabs API constructor.
     */
    constructor() {
        this.createTabContext = this.createTabContext.bind(this);
        this.updateTabContextData = this.updateTabContextData.bind(this);
        this.onTabActivated = this.onTabActivated.bind(this);
        this.deleteTabContext = this.deleteTabContext.bind(this);
        this.getTabContext = this.getTabContext.bind(this);
        this.setTabFrameRule = this.setTabFrameRule.bind(this);
        this.getTabFrameRule = this.getTabFrameRule.bind(this);
        this.setTabFrame = this.setTabFrame.bind(this);
        this.getTabFrame = this.getTabFrame.bind(this);
        this.getTabMainFrame = this.getTabMainFrame.bind(this);
        this.recordFrameRequest = this.recordFrameRequest.bind(this);

        this.logError = this.logError.bind(this);
    }

    /**
     * Sets verbose mode.
     *
     * @param value Boolean flag.
     */
    public setVerbose(value: boolean): void {
        this.verbose = value;
    }

    /**
     * Initializes tabs API and starts listening for tab events.
     */
    public async start(): Promise<void> {
        await this.createCurrentTabsContext();

        // TODO rename to onCreated, onRemoved, onUpdated to be consistent
        browser.tabs.onCreated.addListener(this.createTabContext);
        browser.tabs.onRemoved.addListener(this.deleteTabContext);
        browser.tabs.onUpdated.addListener(this.updateTabContextData);
        browser.tabs.onActivated.addListener(this.onTabActivated);
    }

    /**
     * Stops listening for tab events and clears tabs context.
     */
    public stop(): void {
        browser.tabs.onCreated.removeListener(this.createTabContext);
        browser.tabs.onRemoved.removeListener(this.deleteTabContext);
        browser.tabs.onUpdated.removeListener(this.updateTabContextData);
        browser.tabs.onActivated.removeListener(this.onTabActivated);
        this.context.clear();
    }

    /**
     * Sets frame rule for the tab context.
     *
     * @param tabId Tab ID.
     * @param frameRule Frame rule.
     */
    public setTabFrameRule(tabId: number, frameRule: NetworkRule): void {
        const tabContext = this.context.get(tabId);

        if (tabContext) {
            tabContext.metadata.mainFrameRule = frameRule;
            this.onUpdate.dispatch(tabContext);
        }
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

        const frameRule = tabContext.metadata.mainFrameRule;

        if (!frameRule) {
            return null;
        }

        return frameRule;
    }

    /**
     * Sets frame data for the frame in the tab context.
     *
     * @param tabId Tab ID.
     * @param frameId Frame ID.
     * @param frameData Frame data.
     */
    public setTabFrame(tabId: number, frameId: number, frameData: Frame): void {
        const tabContext = this.context.get(tabId);

        if (tabContext) {
            tabContext.frames.set(frameId, frameData);
            this.onUpdate.dispatch(tabContext);
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
        return this.getTabFrame(tabId, 0);
    }

    /**
     * Records request context to the tab context.
     *
     * @param requestContext Request context.
     */
    public recordFrameRequest(requestContext: RequestContext): void {
        const {
            requestUrl,
            tabId,
            requestType,
            frameId,
        } = requestContext;

        const tabContext = this.context.get(tabId);

        if (!tabContext) {
            return;
        }

        if (requestType === RequestType.Document) {
            tabContext.setMainFrameByRequestContext(requestContext);
        } else {
            tabContext.frames.set(frameId, new Frame(requestUrl, requestContext));
        }
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
     * Updates tab context blocked request count.
     *
     * @param tabId Tab ID.
     * @param increment Increment value.
     * @returns Updated blocked request count.
     */
    public updateTabBlockedRequestCount(tabId: number, increment: number): number | undefined {
        const tabContext = this.context.get(tabId);

        if (!tabContext) {
            return undefined;
        }

        return tabContext.updateBlockedRequestCount(increment);
    }

    /**
     * Updates tab's main frame rule.
     *
     * @param tabId Tab ID.
     */
    public updateTabMainFrameRule(tabId: number): void {
        const tabContext = this.context.get(tabId);

        if (!tabContext) {
            return;
        }

        tabContext.updateMainFrameRule();
    }

    /**
     * Updates tab context data on extension initialization.
     */
    public async updateCurrentTabsMainFrameRules(): Promise<void> {
        const currentTabs = await browser.tabs.query({});

        if (!Array.isArray(currentTabs)) {
            return;
        }

        for (const tab of currentTabs) {
            if (tab.id) {
                this.updateTabMainFrameRule(tab.id);
            }
        }
    }

    /**
     * Checks if tab is a new tab.
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
     */
    private createTabContext(tab: Tabs.Tab): void {
        if (typeof tab.id === 'number') {
            const tabContext = new TabContext(tab);
            this.context.set(tab.id, tabContext);
            this.onCreate.dispatch(tabContext);
        }
    }

    /**
     * Removes tab context by tab ID.
     *
     * @param tabId Tab ID.
     */
    private deleteTabContext(tabId: number): void {
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
     */
    private updateTabContextData(tabId: number, changeInfo: Tabs.OnUpdatedChangeInfoType): void {
        // TODO: we can ignore some events (favicon url update etc.)
        const tabContext = this.context.get(tabId);
        if (tabContext) {
            tabContext.updateTabInfo(changeInfo);
            this.onUpdate.dispatch(tabContext);
        }
    }

    /**
     * Dispatches tab on activated event.
     *
     * @param info Tab activated info.
     * @param info.tabId Tab ID.
     */
    private onTabActivated({ tabId }: Tabs.OnActivatedActiveInfoType): void {
        const tabContext = this.context.get(tabId);

        if (tabContext) {
            this.onActivated.dispatch(tabContext);
        }
    }

    /**
     * Creates context for current tabs state.
     */
    private async createCurrentTabsContext(): Promise<void> {
        const currentTabs = await browser.tabs.query({});

        if (!Array.isArray(currentTabs)) {
            return;
        }

        for (let i = 0; i < currentTabs.length; i += 1) {
            this.createTabContext(currentTabs[i]);
        }
    }

    /**
     * Injects script to the frame by tab id and frame id.
     *
     * @param code Script to be injected.
     * @param tabId Tab ID.
     * @param frameId Frame ID.
     */
    public injectScript(code: string, tabId: number, frameId?: number): void {
        const injectDetails = {
            code,
            frameId,
            runAt: 'document_start',
            matchAboutBlank: true,
        } as ExtensionTypes.InjectDetails;

        browser.tabs
            .executeScript(tabId, injectDetails)
            .catch(this.logError);
    }

    /**
     * Injects css styles to the frame by tab id and frame id.
     *
     * @param code CSS styles to be injected.
     * @param tabId Tab ID.
     * @param frameId Frame ID.
     */
    public injectCss(code: string, tabId: number, frameId?: number): void {
        const injectDetails = {
            code,
            frameId,
            runAt: 'document_start',
            matchAboutBlank: true,
            cssOrigin: 'user',
        } as ExtensionTypes.InjectDetails;

        browser.tabs
            .insertCSS(tabId, injectDetails)
            .catch(this.logError);
    }

    /**
     * // TODO consider using logger service
     * Logs error to the console depending on the verbose mode.
     *
     * @param e Error instance.
     */
    private logError(e: unknown): void {
        if (this.verbose) {
            logger.error(e instanceof Error ? e.message : JSON.stringify(e));
        }
    }
}

export const tabsApi = new TabsApi();
