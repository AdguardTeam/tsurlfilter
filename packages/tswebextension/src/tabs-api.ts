import { NetworkRule } from '@adguard/tsurlfilter/dist/types';
import browser, { Tabs } from 'webextension-polyfill';

import { EventChannel } from './utils';

export interface TabContext extends Tabs.Tab {
    frameRule?: NetworkRule
}

export interface TabsApiInterface {
    start: () => Promise<void>
    stop: () => void;

    getTabContext: (tabId: number) => TabContext | undefined;

    setTabFrameRule: (tabId: number, frameRule: NetworkRule) => void
    getTabFrameRule: (tabId: number) => NetworkRule | null

    onCreate: EventChannel
    onUpdate: EventChannel
    onDelete: EventChannel
}

export class TabsApi implements TabsApiInterface {
    private context = new Map<number, TabContext>();

    public onCreate = new EventChannel();

    public onUpdate = new EventChannel();

    public onDelete = new EventChannel();

    constructor() {
        // bind context of methods, invoked in external event listeners
        this.createTabContext = this.createTabContext.bind(this);
        this.updateTabContext = this.updateTabContext.bind(this);
        this.deleteTabContext = this.deleteTabContext.bind(this);
    }

    public async start() {
        await this.createCurrentTabsContext();

        browser.tabs.onCreated.addListener(this.createTabContext);
        browser.tabs.onRemoved.addListener(this.deleteTabContext);
        browser.tabs.onUpdated.addListener(this.updateTabContext);
    }


    public stop() {
        browser.tabs.onCreated.removeListener(this.createTabContext);
        browser.tabs.onRemoved.removeListener(this.deleteTabContext);
        browser.tabs.onUpdated.removeListener(this.updateTabContext);
        this.context.clear();
    }

    public setTabFrameRule(tabId: number, frameRule: NetworkRule): void {
        const tabContext = this.context.get(tabId);

        if (tabContext) {
            tabContext.frameRule = frameRule;
            this.context.set(tabId, tabContext);
            this.onUpdate.dispatch(tabContext);
        }
    }

    public getTabFrameRule(tabId: number): NetworkRule | null {
        const tabContext = this.context.get(tabId);

        if (!tabContext) {
            return null;
        }

        const frameRule = tabContext.frameRule

        if (!frameRule) {
            return null;
        }

        return frameRule
    }

    public getTabContext(tabId: number): TabContext | undefined {
        return this.context.get(tabId);
    }

    private createTabContext(tab: Tabs.Tab): void {
        if (tab.id) {
            this.context.set(tab.id, tab);
            this.onCreate.dispatch(tab);
        }
    }

    private deleteTabContext(tabId: number): void {
        const tabContext = this.context.get(tabId);
        if (tabContext) {
            this.context.delete(tabId);
            this.onDelete.dispatch(tabContext);
        }
    }

    private updateTabContext(tabId: number, changeInfo: Tabs.OnUpdatedChangeInfoType): void {
        // TODO: we can ignore some events (favicon url update etc.)
        const tabContext = this.context.get(tabId);
        if (tabContext) {
            const newTabContext = Object.assign(tabContext, changeInfo);
            this.context.set(tabId, newTabContext);
            this.onUpdate.dispatch(newTabContext)
        }
    }

    private async createCurrentTabsContext(): Promise<void> {
        const currentTabs = await browser.tabs.query({});

        for (let i = 0; i < currentTabs.length; i += 1) {
            this.createTabContext(currentTabs[i]);
        }
    }
}

export const tabsApi = new TabsApi();
