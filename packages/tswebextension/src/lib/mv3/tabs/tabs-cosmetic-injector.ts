import browser, { type Tabs } from 'webextension-polyfill';

import { logger } from '../../common/utils/logger';
import { MAIN_FRAME_ID } from '../../common/constants';
import { CosmeticApi } from '../background/cosmetic-api';
import { CosmeticFrameProcessor } from '../background/cosmetic-frame-processor';
import { ContentType } from '../../common/request-type';
import { appContext } from '../background/app-context';
import { UserScriptsApi } from '../background/user-scripts-api';

import { FrameMV3 } from './frame';
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
                logger.error('[tsweb.TabsCosmeticInjector.processOpenTabs]: cannot inject cosmetic to open tab: ', promise.reason);
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
                parentFrameId,
                parentDocumentId,
                documentId,
            } = frameDetails;

            tabsApi.setFrameContext(tabId, frameId, new FrameMV3({
                tabId,
                frameId,
                parentFrameId,
                url,
                timeStamp: currentTime,
                parentDocumentId,
                documentId,
            }));

            CosmeticFrameProcessor.handleFrame({
                tabId,
                frameId,
                parentFrameId,
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

            if (!CosmeticApi.shouldApplyCosmetics(tabId, url)) {
                logger.debug(`[tsweb.TabsCosmeticInjector.processOpenTab]: skipping cosmetics injection for background or extension page with tabId ${tabId}, frameId ${frameId} and url ${url}`);
                return;
            }

            const tasks = [
                CosmeticApi.applyCss(tabId, frameId),
            ];

            if (UserScriptsApi.isSupported) {
                tasks.push(CosmeticApi.applyJsFuncsAndScriptletsViaUserScriptsApi(tabId, frameId));
            } else {
                tasks.push(CosmeticApi.applyJsFuncs(tabId, frameId));
                tasks.push(CosmeticApi.applyScriptlets(tabId, frameId));
            }

            // TODO: Can be moved to CosmeticApi.injectCosmetic() like in MV2
            // since it is used not only here.
            // Note: this is an async function, but we will not await it because
            // events do not support async listeners.
            Promise.all(tasks).catch((e) => {
                logger.error('[tsweb.TabsCosmeticInjector.processOpenTab]: cannot apply cosmetic rules: ', e);
            });

            const frameContext = tabsApi.getFrameContext(tabId, frameId);
            if (!frameContext?.cosmeticResult) {
                // eslint-disable-next-line max-len
                logger.debug(`[tsweb.TabsCosmeticInjector.processOpenTab]: cannot log script rules due to not having cosmetic result for tabId: ${tabId}, frameId: ${frameId}.`);
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
