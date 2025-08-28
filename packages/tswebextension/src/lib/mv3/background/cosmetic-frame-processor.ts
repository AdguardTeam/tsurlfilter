import { type CosmeticResult, type CosmeticRule, RequestType } from '@adguard/tsurlfilter';

import { isHttpRequest } from '../../common/utils/url';
import { MAIN_FRAME_ID } from '../../common/constants';
import {
    type PrecalculateCosmeticProps,
    type HandleSubFrameWithoutUrlProps,
    type HandleSubFrameWithUrlProps,
    type HandleMainFrameProps,
} from '../../common/cosmetic-frame-processor';
import { tabsApi } from '../tabs/tabs-api';
import { type PreparedCosmeticResultMV3, type FrameMV3 } from '../tabs/frame';

import { appContext } from './app-context';
import { DocumentApi } from './document-api';
import { engineApi } from './engine-api';
import { CosmeticApi } from './cosmetic-api';
import { UserScriptsApi } from './user-scripts-api';

/**
 * Result of splitting script rules into local and remote. Details in schema:
 *
 * UserScripts API OFF
 *     static filters  -> local   - apply all [via scripting API] (since all of them are built-it).
 *     Custom filters  -> remote  - apply nothing.
 *     User rules      -> remote  - apply only built-it script rules [via scripting API].
 *
 * UserScripts API ON
 *     static filters  -> local   - apply all [via scripting API] (since all of them are built-it).
 *     Custom filters  -> remote  - apply all [via userScripts API].
 *     User rules      -> remote  - apply all [via userScripts API].
 */
type SplitLocalRemoteScriptRulesResult = {
    /**
     * Rules which should be injected with scripting API. Script and scriptlet
     * rules from this array will be checked for locality: if the rule is exists
     * in the bundled filters, it will be injected with the scripting API,
     * otherwise it will be skipped.
     */
    localRules: CosmeticRule[];

    /**
     * Rules which should be injected with user scripts API only if the user
     * scripts permission is granted.
     */
    remoteRules: CosmeticRule[];
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
     * Extract cosmetic rules from the matching result and prepare them for
     * injection to reduce injection time.
     *
     * @param cosmeticResult Cosmetic result to prepare.
     *
     * @returns Prepared cosmetic result with CSS and scripts rules.
     */
    private static prepareCosmeticResult(
        cosmeticResult: CosmeticResult,
    ): PreparedCosmeticResultMV3 {
        const scriptRules = cosmeticResult.getScriptRules();

        const {
            localRules,
            remoteRules,
        } = CosmeticFrameProcessor.splitLocalRemoteScriptRules(scriptRules);

        const areHitsStatsCollected = appContext.configuration?.settings.collectStats || false;

        const preparedCosmeticResult = {
            cssText: CosmeticApi.getCssText(cosmeticResult, areHitsStatsCollected),
            // Local script rules should be processed separately
            // because they will be injected with two different calls
            // to scripting API.
            localRules: {
                ...CosmeticApi.getScriptsAndScriptletsData(localRules),
                rawRules: localRules,
            },
            // Remote script rules should be combined into one script text
            // for the user scripts API.
            remoteRules: {
                scriptText: CosmeticApi.getScriptText(remoteRules),
                rawRules: remoteRules,
            },
        };

        return preparedCosmeticResult;
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

        const preparedCosmeticResult = CosmeticFrameProcessor.prepareCosmeticResult(cosmeticResult);

        tabsApi.updateFrameContext(tabId, frameId, {
            mainFrameUrl,
            matchingResult: result,
            cosmeticResult,
            preparedCosmeticResult,
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

        const preparedCosmeticResult = CosmeticFrameProcessor.prepareCosmeticResult(cosmeticResult);

        tabsApi.updateFrameContext(tabId, frameId, {
            matchingResult,
            cosmeticResult,
            preparedCosmeticResult,
        });
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
            const mainFrameRule = mainFrame?.frameRule || null;
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
     * Split local and remote script rules, it is required to achieve
     * transparency for the security model of the MV3. See the schema below:
     *
     * UserScripts API OFF
     *     static filters  -> local   - apply all [via scripting API] (since all of them are built-it).
     *     Custom filters  -> remote  - apply nothing.
     *     User rules      -> remote  - apply only built-it script rules [via scripting API].
     *
     * UserScripts API ON
     *     static filters  -> local   - apply all [via scripting API] (since all of them are built-it).
     *     Custom filters  -> remote  - apply all [via userScripts API].
     *     User rules      -> remote  - apply all [via userScripts API].
     *
     * @param scriptRules Script rules to split.
     *
     * @returns Object with split local and remote rules.
     */
    private static splitLocalRemoteScriptRules(
        scriptRules: CosmeticRule[],
    ): SplitLocalRemoteScriptRulesResult {
        const res: SplitLocalRemoteScriptRulesResult = {
            localRules: [],
            remoteRules: [],
        };

        for (const rule of scriptRules) {
            const filterId = rule.getFilterListId();

            const isBuiltInRule = engineApi.isLocalFilter(filterId);
            const isUserDefinedRule = engineApi.isUserRulesFilter(filterId);

            /**
             * Rule will be marked as local if it is rule from static filter list
             * OR the user scripts permission is NOT granted AND it is user
             * defined rule. This is needed in future processing, since local
             * rules will be additionally checked for locality before injection.
             */
            if (isBuiltInRule || (!UserScriptsApi.isEnabled && isUserDefinedRule)) {
                res.localRules.push(rule);
            } else {
                res.remoteRules.push(rule);
            }
        }

        return res;
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
