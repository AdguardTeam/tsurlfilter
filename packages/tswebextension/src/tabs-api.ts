import browser, { Tabs } from 'webextension-polyfill';

import { EventChannel } from './utils';

export interface TabMetadata { 
    [key: string]: unknown 
}

export interface TabContext extends Tabs.Tab {
    metadata?: TabMetadata
}

export interface TabsApi {
    start: () => Promise<void>
    stop: () => void;

    updateTabMetadata: (tabId: number, metadata: TabMetadata) => void;
    getTabContext: (tabId: number) => TabContext | undefined;

    onCreate: EventChannel
    onUpdate: EventChannel
    onDelete: EventChannel
}

export const tabsApi: TabsApi = (function () {
    const contextStorage = new Map<number, TabContext>();

    const onCreate = new EventChannel();

    const onUpdate = new EventChannel();

    const onDelete = new EventChannel();


    function updateTabMetadata(tabId: number, metadata: TabMetadata): void {
        const tabContext = contextStorage.get(tabId);

        if (tabContext){
            tabContext.metadata = { ...tabContext?.metadata, ...metadata };
            contextStorage.set(tabId, tabContext);
            onUpdate.dispatch(tabContext);
        }
    }

    function getTabContext(tabId: number): TabContext | undefined {
        return contextStorage.get(tabId);
    }

    function createTabContext(tab: Tabs.Tab): void {
        if (tab.id){
            contextStorage.set(tab.id, tab);
            onCreate.dispatch(tab);
        }   
    }

    function deleteTabContext(tabId: number): void {
        contextStorage.delete(tabId);
        onDelete.dispatch(tabId);
    }

    function updateTabContext(tabId: number, changeInfo: Tabs.OnUpdatedChangeInfoType): void{
        const tabContext = contextStorage.get(tabId);
        if (tabContext){
            contextStorage.set(tabId, { ...tabContext, ...changeInfo });
        }
    }

    async function createCurrentTabsContext(): Promise<void>{
        const currentTabs = await browser.tabs.query({});

        for (let i = 0; i < currentTabs.length; i += 1) {
            createTabContext(currentTabs[i]);
        }
    }

    async function start(){
        await createCurrentTabsContext();

        browser.tabs.onCreated.addListener(createTabContext);
        browser.tabs.onRemoved.addListener(deleteTabContext);
        browser.tabs.onUpdated.addListener(updateTabContext);
    }


    function stop(){
        browser.tabs.onCreated.removeListener(createTabContext);
        browser.tabs.onRemoved.removeListener(deleteTabContext);
        browser.tabs.onUpdated.removeListener(updateTabContext);
        contextStorage.clear();
    }
    
    return {
        start,
        stop,

        updateTabMetadata,
        getTabContext,

        onCreate,
        onDelete,
        onUpdate,
    };
})();