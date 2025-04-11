import { RequestType } from '@adguard/tsurlfilter';

import { isHttpRequest } from '../../common/utils/url';
import { MAIN_FRAME_ID } from '../../common/constants';
import {
    type PrecalculateCosmeticProps,
    type HandleSubFrameWithoutUrlProps,
    type HandleSubFrameWithUrlProps,
    type HandleMainFrameProps,
} from '../../common/cosmetic-frame-processor';
import { tabsApi } from '../tabs/tabs-api';
import { type FrameMV3 } from '../tabs/frame';

import { appContext } from './app-context';
import { DocumentApi } from './document-api';
import { engineApi } from './engine-api';
import { CosmeticApi } from './cosmetic-api';
import { UserScriptsApi } from './user-scripts-api';

/**
 * Cosmetic frame processor.
 */
export class CosmeticFrameProcessor {
    /**
     * Time threshold to consider two events as part of the same frame.
     * The value is chosen experimentally; in most cases, 100 ms is sufficient to consider the onBeforeNavigate
     * and onBeforeRequest events as related to the same frame. It is also small enough to ignore manual page
     * reloads by the user.
     */
    static SAME_FRAME_THRESHOLD_MS = 100;

    /**
     * Check if recalculation should be skipped.
     * If the time passed between two events is less than the threshold,
     * we consider it part of the same frame and do not recalculate.
     * Additionally, we check if the URL has changed.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param url Url.
     * @param timeStamp Event timestamp.
     *
     * @returns True if recalculation should be skipped.
     */
    public static shouldSkipRecalculation(
        tabId: number,
        frameId: number,
        url: string,
        timeStamp: number,
    ): boolean {
        const frameContext = tabsApi.getFrameContext(tabId, frameId);
        if (!frameContext) {
            return false;
        }

        // do not skip recalculation if the URL has changed
        if (frameContext.url !== url) {
            return false;
        }

        const timeDiff = Math.abs(frameContext.timeStamp - timeStamp);

        return timeDiff < CosmeticFrameProcessor.SAME_FRAME_THRESHOLD_MS;
    }

    /**
     * Handle sub frame without url.
     *
     * @param props Handle sub frame without url props.
     */
    public static handleSubFrameWithoutUrl(props: HandleSubFrameWithoutUrlProps): void {
        const {
            tabId,
            frameId,
            mainFrameUrl,
            parentDocumentId,
        } = props;

        let parentFrame: FrameMV3 | undefined;
        let tempParentDocumentId = parentDocumentId;
        while (tempParentDocumentId) {
            parentFrame = tabsApi.getByDocumentId(tabId, tempParentDocumentId);
            tempParentDocumentId = parentFrame?.parentDocumentId;
            if (isHttpRequest(parentFrame?.url)) {
                break;
            }
        }

        if (parentFrame) {
            tabsApi.updateFrameContext(tabId, frameId, {
                preparedCosmeticResult: parentFrame.preparedCosmeticResult,
                mainFrameUrl,
            });
        }
    }

    /**
     * Handle sub frame with url.
     *
     * @param props Handle sub frame with url props.
     */
    public static handleSubFrameWithUrl(props: HandleSubFrameWithUrlProps): void {
        const {
            url,
            tabId,
            frameId,
            mainFrameUrl,
            mainFrameRule,
        } = props;

        const result = engineApi.matchRequest({
            requestUrl: url,
            frameUrl: mainFrameUrl || url,
            requestType: RequestType.SubDocument,
            frameRule: mainFrameRule,
        });

        if (!result) {
            return;
        }

        const cosmeticResult = engineApi.getCosmeticResult(url, result.getCosmeticOption());

        const {
            scriptTexts,
            scriptletDataList,
        } = CosmeticApi.getScriptsAndScriptletsData(cosmeticResult);

        const { configuration } = appContext;
        const areHitsStatsCollected = configuration?.settings.collectStats || false;

        const cssText = CosmeticApi.getCssText(cosmeticResult, areHitsStatsCollected);

        tabsApi.updateFrameContext(tabId, frameId, {
            mainFrameUrl,
            matchingResult: result,
            cosmeticResult,
            preparedCosmeticResult: {
                scriptTexts,
                scriptletDataList,
                cssText,
            },
        });
    }

    /**
     * Handle main frame.
     *
     * @param props Handle main frame props.
     */
    private static handleMainFrame(props: HandleMainFrameProps): void {
        const {
            url,
            tabId,
            frameId,
        } = props;

        if (!isHttpRequest(url)) {
            return;
        }

        tabsApi.resetBlockedRequestsCount(tabId);

        const mainFrameRule = DocumentApi.matchFrame(url);

        tabsApi.setMainFrameRule(tabId, frameId, mainFrameRule);

        const matchingResult = engineApi.matchRequest({
            requestUrl: url,
            frameUrl: url,
            requestType: RequestType.Document,
            frameRule: mainFrameRule,
        });

        if (!matchingResult) {
            return;
        }

        const cosmeticResult = engineApi.getCosmeticResult(url, matchingResult.getCosmeticOption());

        const { configuration } = appContext;
        const areHitsStatsCollected = configuration?.settings.collectStats || false;

        const cssText = CosmeticApi.getCssText(cosmeticResult, areHitsStatsCollected);

        const partialFrameContext: Partial<FrameMV3> = { matchingResult, cosmeticResult };

        /**
         * If user scripts API is supported, we should store one combined script
         * text, because it will be injected once and it is more efficient.
         */
        if (UserScriptsApi.isSupported) {
            const scriptText = CosmeticApi.getScriptText(cosmeticResult.getScriptRules());

            partialFrameContext.preparedCosmeticResult = {
                cssText,
                scriptText,
            };
        } else {
            /**
             * Otherwise, we should store separate script texts and scriptlet
             * data, because they will be injected separately with different
             * params.
             */
            const {
                scriptTexts,
                scriptletDataList,
            } = CosmeticApi.getScriptsAndScriptletsData(cosmeticResult);

            partialFrameContext.preparedCosmeticResult = {
                cssText,
                scriptTexts,
                scriptletDataList,
            };
        }

        tabsApi.updateFrameContext(tabId, frameId, partialFrameContext);
    }

    /**
     * Handles frames used here and in the {@link TabsCosmeticInjector}.
     *
     * @param props Precalculate cosmetic props.
     */
    public static handleFrame(props: PrecalculateCosmeticProps): void {
        const {
            tabId,
            frameId,
            url,
            parentDocumentId,
        } = props;

        const isMainFrame = frameId === MAIN_FRAME_ID;

        if (isMainFrame) {
            CosmeticFrameProcessor.handleMainFrame({
                url,
                tabId,
                frameId,
            });
        } else {
            const mainFrame = tabsApi.getFrameContext(tabId, MAIN_FRAME_ID);
            const mainFrameRule = mainFrame?.frameRule;
            const mainFrameUrl = mainFrame?.url;

            if (!isHttpRequest(url)) {
                CosmeticFrameProcessor.handleSubFrameWithoutUrl({
                    tabId,
                    frameId,
                    mainFrameUrl,
                    parentDocumentId,
                });
            } else {
                CosmeticFrameProcessor.handleSubFrameWithUrl({
                    url,
                    tabId,
                    frameId,
                    mainFrameUrl,
                    mainFrameRule,
                });
            }
        }
    }

    /**
     * Precalculate cosmetic rules for the request.
     * This method used in the webNavigation.onBeforeNavigate event and webRequest.onBeforeRequest event.
     *
     * @param props Precalculate cosmetic props.
     */
    public static precalculateCosmetics(props: PrecalculateCosmeticProps): void {
        CosmeticFrameProcessor.handleFrame(props);
    }
}
