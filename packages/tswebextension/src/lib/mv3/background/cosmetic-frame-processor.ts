import { RequestType } from '@adguard/tsurlfilter';

import { isHttpRequest, MAIN_FRAME_ID } from '../../common';
import { tabsApi } from '../tabs/tabs-api';
import { Frame } from '../tabs/frame';
import { DocumentApi } from './document-api';
import { engineApi } from './engine-api';
import { CosmeticApi } from './cosmetic-api';

/**
 * Precalculate cosmetic props.
 */
type PrecalculateCosmeticProps = {
    /**
     * Frame url.
     */
    url: string,

    /**
     * Frame tab id.
     */
    tabId: number,

    /**
     * Frame id.
     */
    frameId: number,

    /**
     * Frame creation timestamp.
     */
    timeStamp: number,

    /**
     * Parent document id.
     */
    parentDocumentId?: string

    /**
     * Document id.
     */
    documentId?: string,
};

/**
 * Handle sub frame without url props.
 */
type HandleSubFrameWithoutUrlProps = {
    tabId: number,
    frameId: number,
    parentDocumentId?: string,
};

/**
 * Handle sub frame with url props.
 */
type HandleSubFrameWithUrlProps = {
    url: string,
    tabId: number,
    frameId: number,
    rootFrame?: Frame,
    rootFrameRule: any,
};

/**
 * Handle main frame props.
 */
type HandleMainFrameProps = {
    url: string,
    tabId: number,
    frameId: number,
    documentId?: number,
};

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
     * @returns True if recalculation should be skipped.
     */
    private static shouldSkipRecalculation(
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
     * @param props Handle sub frame without url props.
     */
    public static handleSubFrameWithoutUrl(props: HandleSubFrameWithoutUrlProps): void {
        const {
            tabId,
            frameId,
            parentDocumentId,
        } = props;

        let parentFrame: Frame | undefined;
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
            });
        }
    }

    /**
     * Handle sub frame with url.
     * @param props Handle sub frame with url props.
     */
    public static handleSubFrameWithUrl(props: HandleSubFrameWithUrlProps): void {
        const {
            url,
            tabId,
            frameId,
            rootFrame,
            rootFrameRule,
        } = props;

        const result = engineApi.matchRequest({
            requestUrl: url,
            frameUrl: rootFrame?.url || url,
            requestType: RequestType.SubDocument,
            frameRule: rootFrameRule,
        });

        if (!result) {
            return;
        }

        const cosmeticResult = engineApi.getCosmeticResult(url, result.getCosmeticOption());

        const {
            scriptText,
            scriptletDataList,
        } = CosmeticApi.getScriptTextAndScriptlets(cosmeticResult);
        const cssText = CosmeticApi.getCssText(cosmeticResult);

        tabsApi.updateFrameContext(tabId, frameId, {
            matchingResult: result,
            cosmeticResult,
            preparedCosmeticResult: {
                scriptText,
                scriptletDataList,
                cssText,
            },
        });
    }

    /**
     * Handle main frame.
     * @param props Handle main frame props.
     */
    public static handleMainFrame(props: HandleMainFrameProps): void {
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

        if (mainFrameRule) {
            tabsApi.updateFrameContext(tabId, frameId, { frameRule: mainFrameRule });
        }

        const result = engineApi.matchRequest({
            requestUrl: url,
            frameUrl: url,
            requestType: RequestType.Document,
            frameRule: mainFrameRule,
        });

        if (!result) {
            return;
        }

        const cosmeticResult = engineApi.getCosmeticResult(url, result.getCosmeticOption());

        const {
            scriptText,
            scriptletDataList,
        } = CosmeticApi.getScriptTextAndScriptlets(cosmeticResult);
        const cssText = CosmeticApi.getCssText(cosmeticResult);

        tabsApi.updateFrameContext(tabId, frameId, {
            matchingResult: result,
            cosmeticResult,
            preparedCosmeticResult: {
                scriptText,
                scriptletDataList,
                cssText,
            },
        });
    }

    /**
     * Handles frames used here and in the {@link TabsCosmeticInjector}.
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
            const rootFrame = tabsApi.getFrameContext(tabId, MAIN_FRAME_ID);
            const rootFrameRule = rootFrame?.frameRule;

            if (!isHttpRequest(url)) {
                CosmeticFrameProcessor.handleSubFrameWithoutUrl({
                    tabId,
                    frameId,
                    parentDocumentId,
                });
            } else {
                CosmeticFrameProcessor.handleSubFrameWithUrl({
                    url,
                    tabId,
                    frameId,
                    rootFrame,
                    rootFrameRule,
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
        const {
            tabId,
            frameId,
            url,
            timeStamp,
            parentDocumentId,
            documentId,
        } = props;

        if (this.shouldSkipRecalculation(tabId, frameId, url, timeStamp)) {
            return;
        }

        // set in the beginning to let other events know that cosmetic result will be calculated in this event to
        // avoid double calculation
        tabsApi.setFrameContext(tabId, frameId, new Frame({
            tabId,
            frameId,
            url,
            timeStamp,
            documentId,
            parentDocumentId,
        }));

        CosmeticFrameProcessor.handleFrame(props);
    }
}
