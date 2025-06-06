import browser, { type ExtensionTypes } from 'webextension-polyfill';

import { type TabInfo, TabsApiCommon, type TabFrameRequestContextCommon } from '../../../common/tabs/tabs-api';
import { isHttpOrWsRequest } from '../../../common/utils/url';
import { type DocumentApi } from '../document-api';

import { type FrameMV2 } from './frame';
import { TabContext } from './tab-context';

/**
 * Request context data related to the tab's frame.
 */
export type TabFrameRequestContextMV2 = TabFrameRequestContextCommon & {
    /**
     * Whether the request is a redirect with removed parameters.
     */
    isRemoveparamRedirect?: boolean;
};

/**
 * TabsApi works with {@link browser.tabs} to record tabs' URLs - they are
 * needed for work domain-specific blocking/allowing cosmetic rules.
 */
export class TabsApi extends TabsApiCommon<FrameMV2, TabContext> {
    /**
     * Timeout for popup tabs in milliseconds. We consider a tab as a popup if it was created within this time period.
     */
    public static readonly POPUP_TAB_TIMEOUT_MS = 250;

    /**
     * Tabs API constructor.
     *
     * @param documentApi Document API instance.
     */
    constructor(
        readonly documentApi: DocumentApi,
    ) {
        super(documentApi);
    }

    /**
     * @inheritdoc
     */
    protected createTabContext(tab: TabInfo): TabContext {
        return TabContext.createNewTabContext(tab, this.documentApi);
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
     *
     * @returns True if tab is a new tab.
     */
    public isNewPopupTab(tabId: number): boolean {
        const tab = this.context.get(tabId);

        if (!tab) {
            return false;
        }

        const createdAt = tab.createdAtMs;
        const tabAgeMs = Date.now() - createdAt;

        return tabAgeMs < TabsApi.POPUP_TAB_TIMEOUT_MS;
    }

    /**
     * Generates a "synthetic document id".
     *
     * Important: This workaround is needed for Firefox where `parentDocumentId` and `documentId` are not supported,
     * so a unique document ID is generated based on tab and frame IDs.
     * And in some cases it may not help, for example, frame's document can change (e.g. by navigating),
     * but the frame ID remains the same, so the *generated* document ID will be the same.
     *
     * @param tabId Tab ID.
     * @param frameId Frame ID.
     *
     * @returns ID as a string based on tab and frame IDs.
     */
    public static generateId(tabId: number, frameId: number): string {
        return `${tabId}-${frameId}`;
    }

    /**
     * Injects script code to the frame by tab id and frame id.
     *
     * @param tabId Tab ID.
     * @param frameId Frame ID.
     * @param code Script text to be injected.
     *
     * @throws Error if the script injection fails.
     */
    public static async injectScript(tabId: number, frameId: number, code: string): Promise<void> {
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
     * @param tabId Tab ID.
     * @param frameId Frame ID.
     * @param code CSS styles to be injected.
     *
     * @throws Error if the css injection fails.
     */
    public static async injectCss(tabId: number, frameId: number, code: string): Promise<void> {
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
