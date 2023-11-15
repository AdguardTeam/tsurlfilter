import browser, { Tabs } from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter/es/request-type';

import { isHttpOrWsRequest, isHttpRequest } from '../../../common/utils/url';
import { logger } from '../../../common/utils/logger';
import { ContentType } from '../../../common/request-type';
import { CosmeticApi } from '../cosmetic-api';
import { Frame, MAIN_FRAME_ID } from './frame';
import { TabContext } from './tab-context';
import type { EngineApi } from '../engine-api';
import type { DocumentApi } from '../document-api';
import type { TabsApi } from './tabs-api';

/**
 * Injects cosmetic rules into tabs, opened before app initialization.
 */
export class TabsCosmeticInjector {
    /**
     * Create instance of TabsCosmeticInjector.
     *
     * @param engineApi Engine API.
     * @param documentApi  Document API.
     * @param tabsApi  Tabs API.
     */
    constructor(
        private readonly engineApi: EngineApi,
        private readonly documentApi: DocumentApi,
        private readonly tabsApi: TabsApi,
    ) {}

    /**
     * Creates contexts for tabs opened before api initialization and
     * applies cosmetic rules for each frame.
     */
    public async processOpenTabs(): Promise<void> {
        const currentTabs = await browser.tabs.query({});

        const tasks = currentTabs.map((tab) => this.processOpenTab(tab));

        const promises = await Promise.allSettled(tasks);

        // Handles errors
        promises.forEach((promise) => {
            if (promise.status === 'rejected') {
                logger.error(promise.reason);
            }
        });
    }

    /**
     * Creates context for tab opened before api initialization and
     * applies cosmetic rules for each frame.
     *
     * @param tab Tab details.
     */
    private async processOpenTab(tab: Tabs.Tab): Promise<void> {
        if (!TabContext.isBrowserTab(tab)) {
            return;
        }

        const { url } = tab;

        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2549
        if (!isHttpRequest(url)) {
            return;
        }

        const tabContext = new TabContext(tab, this.documentApi);

        const tabId = tab.id;

        this.tabsApi.context.set(tabId, tabContext);

        if (url) {
            tabContext.mainFrameRule = this.documentApi.matchFrame(url);
        }

        const frames = await browser.webNavigation.getAllFrames({ tabId });

        if (!frames) {
            return;
        }

        frames.forEach(({ frameId, url: frameUrl }) => {
            const frame = new Frame(frameUrl);

            tabContext.frames.set(frameId, frame);

            if (!isHttpOrWsRequest(frameUrl)) {
                return;
            }

            const isDocumentFrame = frameId === MAIN_FRAME_ID;

            frame.matchingResult = this.engineApi.matchRequest({
                requestUrl: frameUrl,
                frameUrl,
                requestType: isDocumentFrame ? RequestType.Document : RequestType.SubDocument,
                frameRule: tabContext.mainFrameRule,
            });

            if (!frame.matchingResult) {
                return;
            }

            const cosmeticOption = frame.matchingResult.getCosmeticOption();

            frame.cosmeticResult = this.engineApi.getCosmeticResult(frameUrl, cosmeticOption);

            const { cosmeticResult } = frame;

            CosmeticApi.applyFrameCssRules(frameId, tabId);

            CosmeticApi.applyFrameJsRules(frameId, tabId);

            CosmeticApi.logScriptRules({
                url: frameUrl,
                tabId,
                cosmeticResult,
                timestamp: Date.now(),
                contentType: isDocumentFrame
                    ? ContentType.Document
                    : ContentType.Subdocument,
            });
        });
    }
}
