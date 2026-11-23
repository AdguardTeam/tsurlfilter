import { type CosmeticResult, type CosmeticRule } from '@adguard/tsurlfilter';

import { isCollectStatsEnabledForDocument } from '../../common/collect-hit-stats';
import { USER_FILTER_ID } from '../../common/constants';
import {
    type ContentScriptCosmeticData,
    CosmeticApiCommon,
    type LogJsRulesParams,
    type MarkedCssFrameContext,
} from '../../common/cosmetic-api';
import { type PreparedCosmeticResultCommon } from '../../common/tabs/frame';
import { createFrameMatchQuery } from '../../common/utils/create-frame-match-query';
import { CssCapabilities } from '../../common/utils/css-capabilities';
import { logger } from '../../common/utils/logger';

import { engineApi, tabsApi } from './api';
import { appContext } from './app-context';
import { buildScriptText, InjectionGuard } from './injection-helper';
import { localScriptRulesService } from './services/local-script-rules-service';
import { TabsApi } from './tabs/tabs-api';

/**
 * Data for JS and scriptlet rules for MV2.
 */
type ScriptsAndScriptletsDataMv2 = {
    /**
     * JS and scriptlet rules **combined** script text.
     */
    scriptText: string;
};

type LogJsRulesParamsMv2 = LogJsRulesParams & {
    /**
     * Cosmetic result.
     */
    cosmeticResult: CosmeticResult;
};

/**
 * Cosmetic api class.
 * Used to prepare and inject javascript and css into pages.
 */
export class CosmeticApi extends CosmeticApiCommon {
    /**
     * Timeout for cosmetic injection retry on failure.
     */
    private static readonly INJECTION_RETRY_TIMEOUT_MS = 10;

    /**
     * Max number of tries to inject cosmetic rules.
     *
     * Script or style injection may fail in Firefox,
     * e.g. "Error: Missing host permission for the tab",
     * so we need to retry the injection.
     */
    private static readonly INJECTION_MAX_TRIES = 100;

    /**
     * Waits for a marked CSS injection that is still in progress.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     *
     * @returns A promise that resolves when the pending injection settles.
     */
    public static waitForPendingCssInjection(tabId: number, frameId: number): Promise<void> {
        return CosmeticApiCommon.waitForPendingCssInjectionForContext(
            tabsApi.getFrameContext(tabId, frameId),
        );
    }

    /**
     * Applies scripts from a cosmetic result. It is possible inject a script
     * only once, because after the first inject, we set a flag in an isolated
     * copy of the window and all next calls to `buildScriptText` will return
     * nothing.
     *
     * @see {@link buildScriptText} for details about multiple injects.
     * @see {@link LocalScriptRulesService} for details about script source.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param scriptText Script text.
     *
     * @returns Promise that resolves when the script is injected.
     *
     * @throws Error if the script is not injected due to one of the following reasons:
     * - TabsApi.injectScript() execution error;
     * - app start time is not defined yet.
     */
    public static async injectScript(tabId: number, frameId: number, scriptText: string): Promise<void> {
        return TabsApi.injectScript(
            tabId,
            frameId,
            buildScriptText(scriptText, appContext.startTimeMs, InjectionGuard.Scriptlets),
        );
    }

    /**
     * Applies css from cosmetic result.
     *
     * Patches rule selector adding adguard mark rule info in the content attribute.
     * Example:
     * .selector -> .selector { content: 'adguard{filterId};{ruleText} !important;}.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param cssText Css text.
     *
     * @returns Promise that will be fulfilled with no arguments when all the CSS has been inserted.
     * If any error occurs, the promise will be rejected with an error message.
     *
     * @throws Error if the css is not injected due TabsApi.injectCss() execution error.
     */
    public static async injectCss(tabId: number, frameId: number, cssText: string): Promise<void> {
        return TabsApi.injectCss(tabId, frameId, cssText);
    }

    /**
     * Builds scripts from cosmetic rules.
     *
     * @param rules Cosmetic rules.
     * @param frameUrl Frame url.
     *
     * @returns Script text or empty string if no script rules are passed.
     *
     * @todo Move to common class when a way to use appContext in common
     * class will be found.
     */
    public static getScriptText(rules: CosmeticRule[], frameUrl?: string): string {
        const permittedRules = CosmeticApi.sanitizeScriptRules(rules);

        if (permittedRules.length === 0) {
            return '';
        }

        const uniqueScriptStrings = new Set<string>();

        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2584
        const debug = appContext?.configuration?.settings?.debugScriptlets;

        const scriptParams = {
            debug,
            frameUrl,
        };

        permittedRules.forEach((rule) => {
            const scriptStr = rule.getScript(scriptParams);
            if (scriptStr) {
                uniqueScriptStrings.add(scriptStr);
            }
        });

        const scriptText = CosmeticApi.combineScripts(uniqueScriptStrings);

        return CosmeticApi.wrapScriptText(scriptText);
    }

    /**
     * Generates script text for JS and scriptlet rules from the cosmetic result.
     *
     * @param cosmeticResult Object containing cosmetic rules.
     * @param frameUrl Frame url.
     *
     * @returns An object with `scriptText` — aggregated script text, wrapped for safe execution.
     */
    public static getScriptsAndScriptletsData(
        cosmeticResult: CosmeticResult,
        frameUrl: string,
    ): ScriptsAndScriptletsDataMv2 {
        const scriptRules = cosmeticResult.getScriptRules();

        const scriptText = CosmeticApi.getScriptText(scriptRules, frameUrl);

        return { scriptText };
    }

    /**
     * Returns content script data for applying cosmetic.
     *
     * @param frameUrl Frame url.
     * @param tabId Tab id.
     * @param frameId Frame id.
     *
     * @returns Content script data for applying cosmetic.
     */
    public static getContentScriptData(
        frameUrl: string,
        tabId: number,
        frameId: number,
    ): ContentScriptCosmeticData {
        const { isStorageInitialized } = appContext;

        const data: ContentScriptCosmeticData = {
            isAppStarted: false,
            areHitsStatsCollected: false,
            areNativeHitsStatsCollected: false,
            extCssRules: null,
            nativeCssSelectors: null,
        };

        // if storage is not initialized, then app is not ready yet.
        if (!isStorageInitialized) {
            return data;
        }

        const { isAppStarted, configuration } = appContext;

        const areHitsStatsCollected = configuration?.settings.collectStats || false;

        data.isAppStarted = isAppStarted;
        data.areHitsStatsCollected = areHitsStatsCollected;

        const tabContext = tabsApi.getTabContext(tabId);

        if (!tabContext?.info.url) {
            return data;
        }

        // Do not collect hits stats if website is allowlisted.
        const effectiveCollectStats = isCollectStatsEnabledForDocument(
            areHitsStatsCollected,
            tabContext.mainFrameRule,
        );

        data.areHitsStatsCollected = effectiveCollectStats;

        let cosmeticResult;

        const frameContext = tabsApi.getFrameContext(tabId, frameId);
        const nativeHitsState = frameContext
            ? CosmeticApi.nativeHitsMarkersApplied.get(frameContext)
            : undefined;
        data.areNativeHitsStatsCollected = !!nativeHitsState?.applied
            && nativeHitsState.preparedCosmeticResult === frameContext?.preparedCosmeticResult;

        if (!frameContext || !frameContext.cosmeticResult) {
            const matchQuery = createFrameMatchQuery(frameUrl, frameId, tabContext);

            cosmeticResult = engineApi.matchCosmetic(matchQuery);

            tabsApi.updateFrameContext(tabId, frameId, { cosmeticResult });
        } else {
            cosmeticResult = frameContext.cosmeticResult;
        }

        const isNativeHasSupported = CssCapabilities.isNativeHasPseudoClassSupported();

        data.extCssRules = CosmeticApi.getExtCssRules(
            cosmeticResult,
            {
                areHitsStatsCollected: effectiveCollectStats,
                isNativeHasSupported,
            },
        );

        data.nativeCssSelectors = CosmeticApi.getNativeCssSelectors(
            cosmeticResult,
            { isNativeHasSupported },
        );

        return data;
    }

    /**
     * Re-applies marked native CSS after collection is enabled on an open page.
     *
     * The original stylesheet was injected without markers when the page was
     * loaded with collection disabled. The marked copy is added in user origin,
     * so filtering behavior is unchanged.
     *
     * @param frameUrl Frame url.
     * @param tabId Tab id.
     * @param frameId Frame id.
     *
     * @returns Content script data with marked ExtendedCss rules.
     */
    public static async reapplyMarkedCosmeticData(
        frameUrl: string,
        tabId: number,
        frameId: number,
    ): Promise<ContentScriptCosmeticData> {
        const data = CosmeticApi.getContentScriptData(frameUrl, tabId, frameId);

        if (!data.areHitsStatsCollected) {
            return data;
        }

        const tabContext = tabsApi.getTabContext(tabId);
        if (!tabContext?.info.url) {
            data.areNativeHitsStatsCollected = false;
            return data;
        }

        const frameContext = tabsApi.getFrameContext(tabId, frameId);
        const cosmeticResult = frameContext?.cosmeticResult
            ?? engineApi.matchCosmetic(createFrameMatchQuery(frameUrl, frameId, tabContext));

        // The frame context is only an injection cache key. Old subframes no
        // longer have one, so match from the frame URL and tab context as
        // getContentScriptData() does.
        if (frameContext && CosmeticApi.hasMarkedCssInjected(frameContext, {
            includeCosmeticResult: true,
            checkSyntheticDocumentId: true,
        })) {
            data.areNativeHitsStatsCollected = true;
            CosmeticApi.setNativeHitsMarkersApplied(
                frameContext,
                frameContext.preparedCosmeticResult,
                true,
            );
            return data;
        }

        const isNativeHasSupported = CssCapabilities.isNativeHasPseudoClassSupported();
        const cssText = CosmeticApi.getCssText(cosmeticResult, {
            areHitsStatsCollected: true,
            isNativeHasSupported,
        });

        if (!cssText) {
            // There is no native CSS to inject, so no native hit can be lost.
            data.areNativeHitsStatsCollected = true;
            if (frameContext) {
                CosmeticApi.setNativeHitsMarkersApplied(
                    frameContext,
                    frameContext.preparedCosmeticResult,
                    true,
                );
            }
            return data;
        }

        try {
            await CosmeticApi.injectMarkedCssWithRetries(
                tabId,
                frameId,
                cssText,
                frameContext,
            );
            data.areNativeHitsStatsCollected = true;
            if (frameContext) {
                CosmeticApi.setNativeHitsMarkersApplied(
                    frameContext,
                    frameContext.preparedCosmeticResult,
                    true,
                );
                CosmeticApi.setMarkedCssInjected(frameContext, true);
            }
        } catch (e) {
            // Marked ExtendedCss rules are still applied by the content
            // script, but native hits cannot be counted without this CSS.
            data.areNativeHitsStatsCollected = false;
            if (frameContext) {
                CosmeticApi.setNativeHitsMarkersApplied(
                    frameContext,
                    frameContext.preparedCosmeticResult,
                    false,
                );
            }
            logger.info(`[tsweb.CosmeticApi.reapplyMarkedCosmeticData]: error occurred during injection into tabId ${tabId} and frameId ${frameId} `, e);
        }

        return data;
    }

    /**
     * Logs js rules applied to specific frame.
     *
     * We need a separate function for logging because script rules can be logged before injection
     * to avoid duplicate logs while the js rule is being applied.
     *
     * See {@link WebRequestApi.onBeforeRequest} for details.
     *
     * TODO: Since injection and logging are happened in different places,
     * we do not track was injection successful or not - we log all rules which
     * expected to be applied. We should track injection result.
     *
     * @param params Data for js rule logging.
     */
    public static logScriptRules(params: LogJsRulesParamsMv2): void {
        const scriptRules = CosmeticApi.filterScriptRulesForLog(params);

        super.logScriptRules(params, scriptRules, engineApi);
    }

    /**
     * Injects cosmetic rules to the specified tab and frame.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     */
    public static injectCosmetic(tabId: number, frameId: number): void {
        // Note: this is an async function, but we will not await it
        // because events (where it is used) do not support async listeners.
        Promise.all([
            CosmeticApi.applyJs(tabId, frameId),
            CosmeticApi.applyCss(tabId, frameId),
        ]).catch((e) => {
            logger.error('[tsweb.CosmeticApi.injectCosmetic]: error occurred during injection: ', e);
        });
    }

    /**
     * Injects both js and scriptlet rules to specified tab and frame in MV2.
     *
     * Please note that a separate method is used for scriptlet rules injection in MV3,
     * but in MV2, both js and scriptlet rules are injected together.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param tries Number of tries for the injection in case of failure.
     */
    public static async applyJs(tabId: number, frameId: number, tries = 0): Promise<void> {
        const frameContext = tabsApi.getFrameContext(tabId, frameId);

        const scriptText = frameContext?.preparedCosmeticResult?.scriptText;

        if (!scriptText) {
            return;
        }

        try {
            await CosmeticApi.injectScript(tabId, frameId, scriptText);
        } catch (e) {
            // Retry injection if it fails
            if (tries < CosmeticApi.INJECTION_MAX_TRIES) {
                setTimeout(() => {
                    CosmeticApi.applyJs(tabId, frameId, tries + 1);
                }, CosmeticApi.INJECTION_RETRY_TIMEOUT_MS);
            } else {
                logger.debug('[tsweb.CosmeticApi.applyJs]: error occurred during injection', e);
            }
        }
    }

    /**
     * Filters script rules for logging.
     *
     * @param params Data for JS rule logging.
     *
     * @returns Script rules which expected to be applied and logged.
     */
    private static filterScriptRulesForLog(params: LogJsRulesParamsMv2): CosmeticRule[] {
        const scriptRules = params.cosmeticResult.getScriptRules();

        return CosmeticApi.sanitizeScriptRules(scriptRules);
    }

    /**
     * Filters insecure scripts from remote sources.
     *
     * @param rules Cosmetic rules.
     *
     * @returns Permitted script rules.
     */
    private static sanitizeScriptRules(rules: CosmeticRule[]): CosmeticRule[] {
        return rules.filter(CosmeticApi.shouldSanitizeScriptRule);
    }

    /**
     * Predicate to filter out non-local script rules.
     *
     * @param rule Cosmetic rule.
     *
     * @returns True if the rule is a local script rule, otherwise false.
     */
    private static shouldSanitizeScriptRule(rule: CosmeticRule): boolean {
        // Scriptlets should not be excluded for remote filters
        if (rule.isScriptlet) {
            return true;
        }

        // User rules should not be excluded
        const filterId = rule.getFilterListId();
        if (filterId === USER_FILTER_ID) {
            return true;
        }

        /**
         * @see {@link LocalScriptRulesService} for details about script source
         */
        return localScriptRulesService.isLocal(rule);
    }

    /**
     * Injects marked CSS with the same bounded retry policy as the initial
     * stylesheet.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param cssText Marked CSS text.
     * @param frameContext Frame context that was matched for {@link cssText}.
     * @param tries Number of tries already made.
     *
     * @returns Promise that resolves when the CSS is injected.
     */
    private static async injectMarkedCssWithRetries(
        tabId: number,
        frameId: number,
        cssText: string,
        frameContext: object | undefined,
        tries = 0,
    ): Promise<void> {
        try {
            await CosmeticApi.injectCss(tabId, frameId, cssText);
        } catch (e) {
            if (tries >= CosmeticApi.INJECTION_MAX_TRIES) {
                throw e;
            }

            await new Promise<void>((resolve) => {
                setTimeout(resolve, CosmeticApi.INJECTION_RETRY_TIMEOUT_MS);
            });

            if (tabsApi.getFrameContext(tabId, frameId) !== frameContext) {
                // The frame navigated while waiting. Do not inject the old
                // document's CSS into the new document.
                throw e;
            }

            await CosmeticApi.injectMarkedCssWithRetries(
                tabId,
                frameId,
                cssText,
                frameContext,
                tries + 1,
            );
        }
    }

    /**
     * Injects prepared CSS and retries transient failures.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param frameContext Frame context that was matched for {@link cssText}.
     * @param preparedCosmeticResult Prepared cosmetic result.
     * @param cssText CSS text to inject.
     * @param tries Number of tries already made.
     *
     * @returns A promise that resolves when the CSS is injected or the retry
     * budget is exhausted.
     */
    private static async injectPreparedCssWithRetries(
        tabId: number,
        frameId: number,
        frameContext: MarkedCssFrameContext,
        preparedCosmeticResult: PreparedCosmeticResultCommon,
        cssText: string,
        tries: number,
    ): Promise<void> {
        const { documentId } = frameContext;

        try {
            await CosmeticApi.injectCss(tabId, frameId, cssText);
            const { areHitsStatsCollected } = preparedCosmeticResult;
            CosmeticApi.setNativeHitsMarkersApplied(
                frameContext,
                preparedCosmeticResult,
                areHitsStatsCollected,
            );
            if (areHitsStatsCollected) {
                CosmeticApi.setMarkedCssInjected(frameContext, true);
            }
        } catch (e) {
            if (tries < CosmeticApi.INJECTION_MAX_TRIES) {
                await new Promise<void>((resolve) => {
                    setTimeout(resolve, CosmeticApi.INJECTION_RETRY_TIMEOUT_MS);
                });

                const currentFrameContext = tabsApi.getFrameContext(tabId, frameId);
                if (currentFrameContext !== frameContext
                    || currentFrameContext.documentId !== documentId) {
                    // The frame navigated while waiting. Do not inject the
                    // old document's CSS into the new document.
                    return;
                }

                await CosmeticApi.injectPreparedCssWithRetries(
                    tabId,
                    frameId,
                    frameContext,
                    preparedCosmeticResult,
                    cssText,
                    tries + 1,
                );
            } else {
                CosmeticApi.setNativeHitsMarkersApplied(frameContext, preparedCosmeticResult, false);
                logger.debug('[tsweb.CosmeticApi.injectPreparedCssWithRetries]: error occurred during injection', e);
            }
        }
    }

    /**
     * Injects css to specified tab id and frame id.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param tries Number of tries for the injection in case of failure.
     *
     * @returns A promise that resolves when the CSS is injected or the retry
     * budget is exhausted.
     */
    public static applyCss(tabId: number, frameId: number, tries = 0): Promise<void> {
        const frameContext = tabsApi.getFrameContext(tabId, frameId);
        const preparedCosmeticResult = frameContext?.preparedCosmeticResult;

        if (!frameContext || !preparedCosmeticResult) {
            return Promise.resolve();
        }

        return CosmeticApiCommon.applyCssWithCache({
            frameContext,
            preparedCosmeticResult,
            cssText: preparedCosmeticResult.cssText,
            includeCosmeticResult: true,
            checkSyntheticDocumentId: true,
            inject: () => CosmeticApi.injectPreparedCssWithRetries(
                tabId,
                frameId,
                frameContext,
                preparedCosmeticResult,
                preparedCosmeticResult.cssText as string,
                tries,
            ),
        });
    }
}

const cosmeticApi = new CosmeticApi();

export { cosmeticApi };
