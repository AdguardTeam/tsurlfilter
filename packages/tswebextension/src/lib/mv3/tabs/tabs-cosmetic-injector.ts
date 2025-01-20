import browser, { type Tabs } from 'webextension-polyfill';

import { logger } from '../../common/utils/logger';
import { MAIN_FRAME_ID } from '../../common/constants';
import { CosmeticApi } from '../background/cosmetic-api';
import { CosmeticFrameProcessor } from '../background/cosmetic-frame-processor';
import { ContentType } from '../../common/request-type';
import { appContext } from '../background/app-context';

import { Frame } from './frame';
import { tabsApi } from './tabs-api';
import { TabContext } from './tab-context';

/**
 * Injects cosmetic rules into tabs, opened before app initialization.
 */
export class TabsCosmeticInjector {
    /**
     * Creates contexts for tabs opened before api initialization and
     * applies cosmetic rules for each frame.
     */
    public static async processOpenTabs(): Promise<void> {
        const currentTabs = await browser.tabs.query({});

        const tasks = currentTabs.map((tab) => TabsCosmeticInjector.processOpenTab(tab));

        const promises = await Promise.allSettled(tasks);

        // Handles errors
        promises.forEach((promise) => {
            if (promise.status === 'rejected') {
                logger.error('[tswebextension.processOpenTabs]: cannot inject cosmetic to open tab: ', promise.reason);
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
    private static async processOpenTab(tab: Tabs.Tab): Promise<void> {
        if (!TabContext.isBrowserTab(tab)) {
            return;
        }

        const tabContext = new TabContext(tab);
        const tabId = tab.id;
        tabsApi.context.set(tabId, tabContext);
        tabsApi.updateTabMainFrameRule(tabId);

        const frames = await chrome.webNavigation.getAllFrames({ tabId });

        if (!frames) {
            return;
        }

        const currentTime = Date.now();

        frames.forEach((frameDetails) => {
            const {
                url,
                frameId,
                parentDocumentId,
                documentId,
            } = frameDetails;

            tabsApi.setFrameContext(tabId, frameId, new Frame({
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

            // Note: this is an async function, but we will not await it because
            // events do not support async listeners.
            Promise.all([
                CosmeticApi.applyJsFuncsByTabAndFrame(tabId, frameId),
                CosmeticApi.applyCssByTabAndFrame(tabId, frameId),
                CosmeticApi.applyScriptletsByTabAndFrame(tabId, frameId),
            ]).catch((e) => logger.error(e));

            const frameContext = tabsApi.getFrameContext(tabId, frameId);
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
                contentType: isMainFrame ? ContentType.Document : ContentType.Subdocument,
            });
        });
    }
}
