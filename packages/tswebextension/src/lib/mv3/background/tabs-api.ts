export class TabsApi {
    /**
     * Maps tab id and main frame url
     */
    private context = new Map<number, string>();

    constructor() {
        this.createTabContext = this.createTabContext.bind(this);
        this.updateTabContext = this.updateTabContext.bind(this);
        this.deleteTabContext = this.deleteTabContext.bind(this);
    }

    public async start() {
        await this.createCurrentTabsContext();

        chrome.tabs.onCreated.addListener(this.createTabContext);
        chrome.tabs.onUpdated.addListener(this.updateTabContext);
        chrome.tabs.onRemoved.addListener(this.deleteTabContext);
    }

    public stop() {
        chrome.tabs.onCreated.removeListener(this.createTabContext);
        chrome.tabs.onRemoved.removeListener(this.deleteTabContext);
        chrome.tabs.onUpdated.removeListener(this.updateTabContext);
        this.context.clear();
    }

    public getMainFrameUrl(tabId: number): string | undefined {
        return this.context.get(tabId);
    }

    private async createCurrentTabsContext(): Promise<void> {
        const currentTabs = await chrome.tabs.query({});

        for (let i = 0; i < currentTabs.length; i += 1) {
            this.createTabContext(currentTabs[i]);
        }
    }

    private createTabContext(tab: chrome.tabs.Tab): void {
        if (tab.id && tab.url) {
            this.context.set(tab.id, tab.url);
        }
    }

    private updateTabContext(tabId: number, changeInfo: chrome.tabs.TabChangeInfo) {
        if (changeInfo.url) {
            this.context.set(tabId, changeInfo.url);
        }
    }

    private deleteTabContext(tabId: number): void {
        if (this.context.has(tabId)) {
            this.context.delete(tabId);
        }
    }

    static getActiveTab = (): Promise<chrome.tabs.Tab> => {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const error = chrome.runtime.lastError;
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
