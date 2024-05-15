import browser, { type Tabs } from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter/es/request-type';

import { Frame, MAIN_FRAME_ID } from './frame';
import { TabContext } from './tab-context';
import { tabsApi } from './tabs-api';
import { logger } from '../../common/utils/logger';
import { isHttpOrWsRequest, isHttpRequest } from '../../common/utils/url';
import { engineApi } from '../background/engine-api';

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
    private static async processOpenTab(tab: Tabs.Tab): Promise<void> {
        if (!TabContext.isBrowserTab(tab)) {
            return;
        }

        const { url } = tab;

        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2549
        if (!isHttpRequest(url)) {
            return;
        }

        const tabContext = new TabContext(tab);

        const tabId = tab.id;

        tabsApi.context.set(tabId, tabContext);

        if (url) {
            tabContext.mainFrameRule = engineApi.matchFrame(url);
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

            frame.matchingResult = engineApi.matchRequest({
                requestUrl: frameUrl,
                frameUrl,
                requestType: isDocumentFrame ? RequestType.Document : RequestType.SubDocument,
                frameRule: tabContext.mainFrameRule,
            });

            if (!frame.matchingResult) {
                return;
            }

            const cosmeticOption = frame.matchingResult.getCosmeticOption();

            frame.cosmeticResult = engineApi.getCosmeticResult(frameUrl, cosmeticOption);

            // const { cosmeticResult } = frame;

            // TODO: Inject CSS and JS rules
            // CosmeticApi.applyFrameCssRules(frameId, tabId);

            // CosmeticApi.applyFrameJsRules(frameId, tabId);

            // CosmeticApi.logScriptRules({
            //     url: frameUrl,
            //     tabId,
            //     cosmeticResult,
            //     timestamp: Date.now(),
            //     contentType: isDocumentFrame
            //         ? ContentType.Document
            //         : ContentType.Subdocument,
            // });
        });
    }
}
