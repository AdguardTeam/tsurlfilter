import { nanoid } from 'nanoid';
import browser, { Tabs } from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter/es/request-type';

import { isHttpOrWsRequest } from '../../../common/utils/url';
import { logger } from '../../../common/utils/logger';
import { ContentType } from '../../../common/request-type';
import { allowlistApi } from '../allowlist';
import {
    type ApplyCssRulesParams,
    type ApplyJsRulesParams,
    CosmeticApi,
} from '../cosmetic-api';
import { engineApi } from '../engine-api';
import { Frame, MAIN_FRAME_ID } from './frame';
import { TabContext } from './tab-context';
import { tabsApi } from './tabs-api';

/**
 * Injects cosmetic rules into tabs, opened before app initialization.
 */
export class TabsCosmeticInjector {
    /**
     * Synthetic request id prefix for frames, opened before extension initialization.
     * Used in filtering log for displaying cosmetic rule events.
     */
    private static SYNTHETIC_REQUEST_ID_PREFIX = 'synthetic';

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

        const tabContext = new TabContext(tab);

        const tabId = tab.id;

        tabsApi.context.set(tabId, tabContext);

        if (tab.url) {
            tabContext.mainFrameRule = allowlistApi.matchFrame(tab.url);
        }

        const frames = await browser.webNavigation.getAllFrames({ tabId });

        if (!frames) {
            return;
        }

        frames.forEach(({ frameId, url }) => {
            const frame = new Frame(url);

            tabContext.frames.set(frameId, frame);

            if (!isHttpOrWsRequest(url)) {
                return;
            }

            const isDocumentFrame = frameId === MAIN_FRAME_ID;

            frame.matchingResult = engineApi.matchRequest({
                requestUrl: url,
                frameUrl: url,
                requestType: isDocumentFrame ? RequestType.Document : RequestType.SubDocument,
                frameRule: tabContext.mainFrameRule,
            });

            if (!frame.matchingResult) {
                return;
            }

            const cosmeticOption = frame.matchingResult.getCosmeticOption();

            frame.cosmeticResult = engineApi.getCosmeticResult(url, cosmeticOption);

            const {
                cosmeticResult,
                cssInjectionFsm,
                jsInjectionFsm,
            } = frame;

            const cssInjectionParams: ApplyCssRulesParams = {
                tabId,
                frameId,
                cosmeticResult,
            };

            const jsInjectionParams: ApplyJsRulesParams = {
                url,
                tabId,
                frameId,
                cosmeticResult,
                requestId: TabsCosmeticInjector.generateFrameRequestId(),
                timestamp: Date.now(),
                contentType: isDocumentFrame
                    ? ContentType.Document
                    : ContentType.Subdocument,
            };

            CosmeticApi.applyFrameCssRules(cssInjectionParams, cssInjectionFsm);
            CosmeticApi.applyFrameJsRules(jsInjectionParams, jsInjectionFsm);
        });
    }

    /**
     * Generates synthetic request id for frame, opened before extension initialization.
     * Used for logging js rule apply.
     *
     * @returns Request id.
     */
    private static generateFrameRequestId(): string {
        return `${TabsCosmeticInjector.SYNTHETIC_REQUEST_ID_PREFIX}-${nanoid(7)}`;
    }
}
