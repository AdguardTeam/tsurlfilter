import browser, { type Tabs } from 'webextension-polyfill';

import { MAIN_FRAME_ID } from '../../../common/constants';
import { logger } from '../../../common/utils/logger';
import { ContentType } from '../../../common/request-type';
import { CosmeticApi } from '../cosmetic-api';
import { CosmeticFrameProcessor } from '../cosmetic-frame-processor';
import { appContext } from '../app-context';
import type { DocumentApi } from '../document-api';

import { FrameMV2 } from './frame';
import type { TabsApi } from './tabs-api';
import { TabContext } from './tab-context';

/**
 * Injects cosmetic rules into tabs, opened before app initialization.
 */
export class TabsCosmeticInjector {
    /**
     * Create instance of TabsCosmeticInjector.
     *
     * @param documentApi  Document API.
     * @param tabsApi  Tabs API.
     */
    constructor(
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

        appContext.cosmeticsInjectedOnStartup = true;
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

        const tabContext = TabContext.createNewTabContext(tab, this.documentApi);
        const tabId = tab.id;
        this.tabsApi.context.set(tabId, tabContext);
        this.tabsApi.updateTabMainFrameRule(tabId);

        const frames = await browser.webNavigation.getAllFrames({ tabId });

        if (!frames) {
            return;
        }

        const currentTime = Date.now();

        frames.forEach((frameDetails) => {
            const {
                url,
                frameId,
                // FIXME (Slava): supported by chrome 106+ so increase minimal supported browser version
                // FIXME (Slava): check firefox
                // @ts-ignore
                parentDocumentId,
                // FIXME (Slava): supported by chrome 106+ so increase minimal supported browser version
                // FIXME (Slava): check firefox
                // @ts-ignore
                documentId,
            } = frameDetails;

            this.tabsApi.setFrameContext(tabId, frameId, new FrameMV2({
                tabId,
                frameId,
                url,
                timeStamp: currentTime,
                parentDocumentId,
                documentId,
            }));

            CosmeticFrameProcessor.handleFrame({
                tabId,
                frameId,
                url,
                timeStamp: currentTime,
                parentDocumentId,
                documentId,
            });

            // TODO: Instead of this, it’s better to use the runtime.onStartup and runtime.onInstalled
            // events to inject cosmetics once during the extension's initialization
            // and browser startup without flags.
            // However, this would require big refactoring of the extension.
            /**
             * This condition prevents applying cosmetic rules to the tab multiple times.
             * Applying them once after the extension's initialization is enough.
             */
            if (appContext.cosmeticsInjectedOnStartup) {
                return;
            }

            CosmeticApi.applyJsByTabAndFrame(tabId, frameId);
            CosmeticApi.applyCssByTabAndFrame(tabId, frameId);

            const frameContext = this.tabsApi.getFrameContext(tabId, frameId);
            if (!frameContext?.cosmeticResult) {
                // eslint-disable-next-line max-len
                logger.debug(`[tswebextension.processOpenTab]: cannot log script rules due to not having cosmetic result for tabId: ${tabId}, frameId: ${frameId}.`);
                return;
            }

            const isMainFrame = frameId === MAIN_FRAME_ID;
            CosmeticApi.logScriptRules({
                url,
                tabId,
                cosmeticResult: frameContext.cosmeticResult,
                timestamp: currentTime,
                contentType: isMainFrame
                    ? ContentType.Document
                    : ContentType.Subdocument,
            });
        });
    }
}
