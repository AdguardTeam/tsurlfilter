import { NetworkRule, RequestType } from '@adguard/tsurlfilter';
import browser, { ExtensionTypes, Tabs } from 'webextension-polyfill';
import { TabContext } from './tab-context';
import { Frame } from './frame';

import { EventChannel } from '../utils';

export interface TabsApiInterface {
    start: () => Promise<void>
    stop: () => void

    getTabContext: (tabId: number) => TabContext | undefined

    setTabFrameRule: (tabId: number, frameRule: NetworkRule) => void
    getTabFrameRule: (tabId: number) => NetworkRule | null

    setTabFrame: (tabId: number, frameId: number, frameData: Frame) => void
    getTabFrame: (tabId: number, frameId: number) => Frame | null
    getTabMainFrame: (tabId: number) => Frame | null
    recordRequestFrame: (
        tabId: number,
        frameId: number,
        referrerUrl: string,
        requestType: RequestType
    ) => void

    injectScript: (code: string, tabId: number, frameId?: number) => void
    injectCss: (code: string, tabId: number, frameId?: number) => void

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
        this.createTabContext = this.createTabContext.bind(this);
        this.updateTabContextData = this.updateTabContextData.bind(this);
        this.deleteTabContext = this.deleteTabContext.bind(this);
        this.getTabContext = this.getTabContext.bind(this);
        this.setTabFrameRule = this.setTabFrameRule.bind(this);
        this.getTabFrameRule = this.getTabFrameRule.bind(this);
        this.setTabFrame = this.setTabFrame.bind(this);
        this.getTabFrame = this.getTabFrame.bind(this);
        this.getTabMainFrame = this.getTabMainFrame.bind(this);
        this.recordRequestFrame = this.recordRequestFrame.bind(this);
        this.injectScript = this.injectScript.bind(this);
        this.injectCss = this.injectCss.bind(this);
    }

    public async start() {
        await this.createCurrentTabsContext();

        browser.tabs.onCreated.addListener(this.createTabContext);
        browser.tabs.onRemoved.addListener(this.deleteTabContext);
        browser.tabs.onUpdated.addListener(this.updateTabContextData);
    }


    public stop() {
        browser.tabs.onCreated.removeListener(this.createTabContext);
        browser.tabs.onRemoved.removeListener(this.deleteTabContext);
        browser.tabs.onUpdated.removeListener(this.updateTabContextData);
        this.context.clear();
    }

    public setTabFrameRule(tabId: number, frameRule: NetworkRule): void {
        const tabContext = this.context.get(tabId);

        if (tabContext) {
            tabContext.metadata.mainFrameRule = frameRule;
            this.onUpdate.dispatch(tabContext);
        }
    }

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


    public setTabFrame(tabId: number, frameId: number, frameData: Frame) {
        const tabContext = this.context.get(tabId);

        if (tabContext) {
            tabContext.frames.set(frameId, frameData);
            this.onUpdate.dispatch(tabContext);
        }
    }

    public getTabFrame(tabId: number, frameId: number) {
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

    public getTabMainFrame(tabId: number) {
        return this.getTabFrame(tabId, 0);
    }

    public recordRequestFrame(
        tabId: number, 
        frameId: number, 
        referrerUrl: string, 
        requestType: RequestType,
    ) {
        const tabContext = this.context.get(tabId);

        if (!tabContext) {
            return;
        }

        if (requestType === RequestType.Document) {
            tabContext.reloadTabFrameData(referrerUrl);
        } else {
            tabContext.frames.set(frameId, new Frame({
                url: referrerUrl,
            }));
        } 
    }

    public getTabContext(tabId: number): TabContext | undefined {
        return this.context.get(tabId);
    }

    public injectScript(code: string, tabId: number, frameId?: number): void {
        const injectDetails = {
            code,
            frameId,
            runAt: 'document_start',
            matchAboutBlank: true,     
        } as ExtensionTypes.InjectDetails;

        browser.tabs.executeScript(tabId, injectDetails);
    }

    public injectCss(code: string, tabId: number, frameId?: number): void {
        const injectDetails = {
            code,
            frameId,
            runAt: 'document_start',
            matchAboutBlank: true,
            cssOrigin: 'user',
        } as ExtensionTypes.InjectDetails;
    
        browser.tabs.insertCSS(tabId, injectDetails);
    }

    private createTabContext(tab: Tabs.Tab): void {
        if (tab.id) {
            const tabContext = new TabContext(tab);
            this.context.set(tab.id, tabContext);
            this.onCreate.dispatch(tabContext);
        }
    }

    private deleteTabContext(tabId: number): void {
        const tabContext = this.context.get(tabId);
        if (tabContext) {
            this.context.delete(tabId);
            this.onDelete.dispatch(tabContext);
        }
    }

    private updateTabContextData(tabId: number, changeInfo: Tabs.OnUpdatedChangeInfoType): void {
        // TODO: we can ignore some events (favicon url update etc.)
        const tabContext = this.context.get(tabId);
        if (tabContext) {
            tabContext.updateTabInfo(changeInfo);
            this.onUpdate.dispatch(tabContext);
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
