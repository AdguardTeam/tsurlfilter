/**
 * TabsApi works with {@link chrome.tabs} to record tabs URL's - they needed
 * for work domain-specific blocking/allowing cosmetic rules.
 *
 * TODO: Add persistent storage for cases of deaths service worker.
 */
export class TabsApi {
    /**
     * Records with the URL of the main frame for each tab ID.
     */
    private context = new Map<number, string>();

    /**
     * Creates new {@link TabsApi} with binding context.
     */
    constructor() {
        this.createTabContext = this.createTabContext.bind(this);
        this.updateTabContext = this.updateTabContext.bind(this);
        this.deleteTabContext = this.deleteTabContext.bind(this);
    }

    /**
     * Starts recording the main frame URL's for the tabs.
     */
    public async start(): Promise<void> {
        await this.createCurrentTabsContext();

        chrome.tabs.onCreated.addListener(this.createTabContext);
        chrome.tabs.onUpdated.addListener(this.updateTabContext);
        chrome.tabs.onRemoved.addListener(this.deleteTabContext);
    }

    /**
     * Stops recording the main frame URL's for the tabs.
     */
    public stop(): void {
        chrome.tabs.onCreated.removeListener(this.createTabContext);
        chrome.tabs.onRemoved.removeListener(this.deleteTabContext);
        chrome.tabs.onUpdated.removeListener(this.updateTabContext);

        this.context.clear();
    }

    /**
     * Returns main frame URL for provided tab ID.
     *
     * @param tabId Tab ID.
     *
     * @returns Main frame URL for provided tab ID.
     */
    public getMainFrameUrl(tabId: number): string | undefined {
        return this.context.get(tabId);
    }

    /**
     * For each of the currently opened tabs saves the URL of the main frame.
     */
    private async createCurrentTabsContext(): Promise<void> {
        const currentTabs = await chrome.tabs.query({});

        for (let i = 0; i < currentTabs.length; i += 1) {
            this.createTabContext(currentTabs[i]);
        }
    }

    /**
     * Saves the main frame URL of the provided tab.
     *
     * @param tab Item of {@link chrome.tabs.Tab}.
     */
    private createTabContext(tab: chrome.tabs.Tab): void {
        if (tab.id && tab.url) {
            this.context.set(tab.id, tab.url);
        }
    }

    /**
     * Updates saved the main frame URL of the provided tab.
     *
     * @param tabId Tab id.
     * @param changeInfo Item of {@link chrome.tabs.TabChangeInfo}.
     */
    private updateTabContext(
        tabId: number,
        changeInfo: chrome.tabs.TabChangeInfo,
    ): void {
        if (changeInfo.url) {
            this.context.set(tabId, changeInfo.url);
        }
    }

    /**
     * Deletes saved the main frame URL of the provided tab.
     *
     * @param tabId Tab id.
     */
    private deleteTabContext(tabId: number): void {
        if (this.context.has(tabId)) {
            this.context.delete(tabId);
        }
    }

    /**
     * Returns current active tab.
     *
     * @returns Current active tab.
     */
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
