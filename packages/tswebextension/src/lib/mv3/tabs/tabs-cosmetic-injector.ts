import browser, { type Tabs } from 'webextension-polyfill';

import { logger } from '../../common/utils/logger';
import { MAIN_FRAME_ID } from '../../common/constants';
import { CosmeticApi } from '../background/cosmetic-api';
import { CosmeticFrameProcessor } from '../background/cosmetic-frame-processor';
import { ContentType } from '../../common/request-type';
import { appContext } from '../background/app-context';

import { FrameMV3 } from './frame';
import { tabsApi } from './tabs-api';
import { TabContext } from './tab-context';

/**
 * Injects cosmetic rules into tabs, opened before app initialization.
 */
export class TabsCosmeticInjector {
    /**
     * Timeout for processing open tabs during startup.
     * Fail-open: if processing takes longer than this, startup continues anyway.
     */
    private static readonly PROCESS_OPEN_TABS_TIMEOUT_MS = 10_000;

    /**
     * Creates contexts for tabs opened before api initialization and
     * applies cosmetic rules for each frame.
     * Includes a fail-open timeout to prevent blocking startup indefinitely.
     */
    public static async processOpenTabs(): Promise<void> {
        const result = await new Promise<'done' | 'timeout'>((resolve) => {
            const timeoutId = setTimeout(() => {
                resolve('timeout');
            }, TabsCosmeticInjector.PROCESS_OPEN_TABS_TIMEOUT_MS);

            TabsCosmeticInjector.doProcessOpenTabs()
                .then(() => {
                    clearTimeout(timeoutId);
                    resolve('done');
                })
                .catch((error) => {
                    clearTimeout(timeoutId);
                    logger.error('[tsweb.TabsCosmeticInjector.processOpenTabs]: error processing open tabs: ', error);
                    resolve('done');
                });
        });

        if (result === 'timeout') {
            logger.debug(
                `[tsweb.TabsCosmeticInjector.processOpenTabs]: timeout after ${TabsCosmeticInjector.PROCESS_OPEN_TABS_TIMEOUT_MS}ms, continue startup in fail-open mode`,
            );
        }
    }

    /**
     * Internal implementation: queries all open tabs and injects cosmetics.
     */
    private static async doProcessOpenTabs(): Promise<void> {
        const currentTabs = await browser.tabs.query({});

        const tasks = currentTabs.map((tab) => TabsCosmeticInjector.processOpenTab(tab));

        const promises = await Promise.allSettled(tasks);

        // Handles errors
        promises.forEach((promise) => {
            if (promise.status === 'rejected') {
                logger.error(
                    '[tsweb.TabsCosmeticInjector.doProcessOpenTabs]: cannot inject cosmetic to open tab: ',
                    promise.reason,
                );
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

        const tasks = frames.map(async (frameDetails) => {
            const { url, frameId, parentFrameId, parentDocumentId, documentId } = frameDetails;

            tabsApi.setFrameContext(
                tabId,
                frameId,
                new FrameMV3({
                    tabId,
                    frameId,
                    parentFrameId,
                    url,
                    timeStamp: currentTime,
                    parentDocumentId,
                    documentId,
                }),
            );

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
                logger.debug(
                    `[tsweb.TabsCosmeticInjector.processOpenTab]: skipping cosmetics injection for background or extension page with tabId ${tabId}, frameId ${frameId} and url ${url}`,
                );
                return;
            }

            try {
                await CosmeticApi.applyCosmeticRules(tabId, frameId, true);
            } catch (e) {
                logger.error(
                    `[tsweb.TabsCosmeticInjector.processOpenTab]: error applying cosmetic rules for tabId ${tabId} and frameId ${frameId}`,
                    e,
                );
            }

            const frameContext = tabsApi.getFrameContext(tabId, frameId);
            if (!frameContext?.preparedCosmeticResult) {
                logger.debug(
                    `[tsweb.TabsCosmeticInjector.processOpenTab]: cannot log script rules due to not having prepared cosmetic result for tabId: ${tabId}, frameId: ${frameId}.`,
                );
                return;
            }

            const isMainFrame = frameId === MAIN_FRAME_ID;
            CosmeticApi.logScriptRules({
                url,
                tabId,
                preparedCosmeticResult: frameContext.preparedCosmeticResult,
                timestamp: currentTime,
                contentType: isMainFrame ? ContentType.Document : ContentType.Subdocument,
            });
        });

        await Promise.allSettled(tasks);
    }
}
