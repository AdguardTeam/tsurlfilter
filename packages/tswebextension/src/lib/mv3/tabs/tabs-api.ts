import browser, { type Tabs } from 'webextension-polyfill';
import { type NetworkRule } from '@adguard/tsurlfilter';

import { MAIN_FRAME_ID } from '../../common/constants';
import { TabsApiCommon, type TabFrameRequestContextCommon } from '../../common/tabs/tabs-api';
import { isHttpOrWsRequest } from '../../common/utils/url';
import { DocumentApi } from '../background/document-api';

import { type FrameMV3 } from './frame';
import { TabContext } from './tab-context';

/**
 * Request context data related to the tab's frame.
 */
export type TabFrameRequestContextMV3 = TabFrameRequestContextCommon;

/**
 * TabsApi works with {@link browser.tabs} to record tabs' URLs - they are
 * needed for work domain-specific blocking/allowing cosmetic rules.
 */
export class TabsApi extends TabsApiCommon<FrameMV3, TabContext> {
    /**
     * @inheritdoc
     */
    protected handleTabCreate(tab: Tabs.Tab): TabContext | null {
        if (!TabContext.isBrowserTab(tab)) {
            return null;
        }

        const tabContext = TabContext.createNewTabContext(tab);
        this.context.set(tab.id, tabContext);
        this.onCreate.dispatch(tabContext);
        return tabContext;
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
}

export const tabsApi = new TabsApi();
