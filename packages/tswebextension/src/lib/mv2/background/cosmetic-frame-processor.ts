import { RequestType } from '@adguard/tsurlfilter';

import { isHttpRequest } from '../../common/utils/url';
import { LF, MAIN_FRAME_ID } from '../../common/constants';
import {
    type PrecalculateCosmeticProps,
    type HandleSubFrameWithoutUrlProps,
    type HandleSubFrameWithUrlProps,
    type HandleMainFrameProps,
} from '../../common/cosmetic-frame-processor';

import { documentApi } from './api';
import { appContext } from './app-context';
import { CosmeticApi } from './cosmetic-api';
import { type EngineApi } from './engine-api';
import { stealthApi } from './stealth-api';
import { FrameMV2 } from './tabs/frame';
import { type TabsApi } from './tabs/tabs-api';

/**
 * Cosmetic frame processor.
 *
 * Needed to properly handle cosmetic rules for frames, especially for 'about:blank' frames.
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
     * Initializes a new instance of the {@link CosmeticFrameProcessor} class.
     *
     * @param engineApi Engine API instance.
     * @param tabsApi Tabs API instance.
     */
    constructor(
        private readonly engineApi: EngineApi,
        private readonly tabsApi: TabsApi,
    ) {}

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
    private shouldSkipRecalculation(
        tabId: number,
        frameId: number,
        url: string,
        timeStamp: number,
    ): boolean {
        const frameContext = this.tabsApi.getFrameContext(tabId, frameId);
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
    private handleSubFrameWithoutUrl(props: HandleSubFrameWithoutUrlProps): void {
        const {
            tabId,
            frameId,
            mainFrameUrl,
            parentDocumentId,
        } = props;

        let parentFrame: FrameMV2 | undefined;
        let tempParentDocumentId = parentDocumentId;
        while (tempParentDocumentId) {
            parentFrame = this.tabsApi.getByDocumentId(tabId, tempParentDocumentId);
            tempParentDocumentId = parentFrame?.parentDocumentId;
            if (isHttpRequest(parentFrame?.url)) {
                break;
            }
        }

        if (parentFrame) {
            this.tabsApi.updateFrameContext(tabId, frameId, {
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
    private handleSubFrameWithUrl(props: HandleSubFrameWithUrlProps): void {
        const {
            url,
            tabId,
            frameId,
            mainFrameUrl,
            mainFrameRule,
        } = props;

        const result = this.engineApi.matchRequest({
            requestUrl: url,
            frameUrl: mainFrameUrl || url,
            requestType: RequestType.SubDocument,
            frameRule: mainFrameRule,
        });

        if (!result) {
            return;
        }

        const cosmeticResult = this.engineApi.getCosmeticResult(url, result.getCosmeticOption());

        const { configuration } = appContext;
        const areHitsStatsCollected = configuration?.settings.collectStats || false;

        const cssText = CosmeticApi.getCssText(cosmeticResult, areHitsStatsCollected);

        const { scriptText } = CosmeticApi.getScriptsAndScriptletsData(cosmeticResult, url);
        const stealthScriptText = stealthApi.getStealthScript(mainFrameRule, result);

        let combinedScriptText = '';
        if (stealthScriptText.length > 0) {
            combinedScriptText += `${stealthScriptText}${LF}`;
        }
        combinedScriptText += scriptText;

        this.tabsApi.updateFrameContext(tabId, frameId, {
            mainFrameUrl,
            matchingResult: result,
            cosmeticResult,
            preparedCosmeticResult: {
                scriptText: combinedScriptText,
                cssText,
            },
        });
    }

    /**
     * Handle main frame.
     *
     * @param props Handle main frame props.
     */
    private handleMainFrame(props: HandleMainFrameProps): void {
        const {
            url,
            tabId,
            frameId,
        } = props;

        if (!isHttpRequest(url)) {
            return;
        }

        this.tabsApi.resetBlockedRequestsCount(tabId);

        const mainFrameRule = documentApi.matchFrame(url);

        if (mainFrameRule) {
            this.tabsApi.updateFrameContext(tabId, frameId, { frameRule: mainFrameRule });
        }

        const result = this.engineApi.matchRequest({
            requestUrl: url,
            frameUrl: url,
            requestType: RequestType.Document,
            frameRule: mainFrameRule,
        });

        if (!result) {
            return;
        }

        const cosmeticResult = this.engineApi.getCosmeticResult(url, result.getCosmeticOption());

        const { configuration } = appContext;
        const areHitsStatsCollected = configuration?.settings.collectStats || false;

        const cssText = CosmeticApi.getCssText(cosmeticResult, areHitsStatsCollected);

        const { scriptText } = CosmeticApi.getScriptsAndScriptletsData(cosmeticResult, url);
        const stealthScriptText = stealthApi.getStealthScript(mainFrameRule, result);

        let combinedScriptText = '';
        if (stealthScriptText.length > 0) {
            combinedScriptText += `${stealthScriptText}${LF}`;
        }
        combinedScriptText += scriptText;

        this.tabsApi.updateFrameContext(tabId, frameId, {
            matchingResult: result,
            cosmeticResult,
            preparedCosmeticResult: {
                scriptText: combinedScriptText,
                cssText,
            },
        });
    }

    /**
     * Handles frames used here and in the {@link TabsCosmeticInjector}.
     *
     * @param props Precalculate cosmetic props.
     */
    public handleFrame(props: PrecalculateCosmeticProps): void {
        const {
            tabId,
            frameId,
            url,
            parentDocumentId,
        } = props;

        const isMainFrame = frameId === MAIN_FRAME_ID;

        if (isMainFrame) {
            this.handleMainFrame({
                url,
                tabId,
                frameId,
            });
        } else {
            const mainFrame = this.tabsApi.getFrameContext(tabId, MAIN_FRAME_ID);
            const mainFrameRule = mainFrame?.frameRule;
            const mainFrameUrl = mainFrame?.url;

            if (!isHttpRequest(url)) {
                this.handleSubFrameWithoutUrl({
                    tabId,
                    frameId,
                    mainFrameUrl,
                    parentDocumentId,
                });
            } else {
                this.handleSubFrameWithUrl({
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
     *
     * This method used in the webNavigation.onBeforeNavigate event and webRequest.onBeforeRequest event —
     * as sooner as possible to calculate cosmetic rules for the request,
     * so after that they can be applied on further events without additional calculations.
     *
     * @param props Precalculate cosmetic props.
     */
    public precalculateCosmetics(props: PrecalculateCosmeticProps): void {
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
        this.tabsApi.setFrameContext(tabId, frameId, new FrameMV2({
            tabId,
            frameId,
            url,
            timeStamp,
            documentId,
            parentDocumentId,
        }));

        this.handleFrame(props);
    }
}
