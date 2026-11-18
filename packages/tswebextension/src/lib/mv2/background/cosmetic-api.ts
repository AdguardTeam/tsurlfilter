import { type CosmeticResult, type CosmeticRule } from '@adguard/tsurlfilter';

import { isCollectStatsEnabledForDocument } from '../../common/collect-hit-stats';
import { USER_FILTER_ID } from '../../common/constants';
import {
    type ContentScriptCosmeticData,
    CosmeticApiCommon,
    ExtCssMarkersState,
    type LogJsRulesParams,
    type MarkedCssFrameContext,
} from '../../common/cosmetic-api';
import { ExtCssGuardError } from '../../common/extcss-guard-error';
import { EXTCSS_PROTOCOL, type ExtCssApplyResult } from '../../common/extcss-protocol';
import { type PreparedCosmeticResultCommon } from '../../common/tabs/frame';
import { createFrameMatchQuery } from '../../common/utils/create-frame-match-query';
import { CssCapabilities } from '../../common/utils/css-capabilities';
import { logger } from '../../common/utils/logger';

import { engineApi, tabsApi } from './api';
import { appContext } from './app-context';
import { serializeExtCssDisposeForCode, serializeExtCssForCode } from './extcss-code';
import { buildScriptText, InjectionGuard } from './injection-helper';
import { localScriptRulesService } from './services/local-script-rules-service';
import {
    type ExtCssFrameData,
    type ExtCssInjectionChain,
    type ExtCssInjectionOperation,
    type FrameMV2,
} from './tabs/frame';
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
 * Result of the marked native CSS injection.
 *
 * `stale` means the captured document is no longer displayed, so nothing was
 * injected and the response must not describe the new document.
 */
type MarkedCssInjectionResult = 'injected' | 'stale';

/**
 * Options for {@link CosmeticApi.applyExtCss}.
 */
type ApplyExtCssOptions = {
    /**
     * ExtendedCSS data to inject instead of the frame's prepared data.
     *
     * The marked-data reapply rebuilds the rules with hit markers, because the
     * prepared ones were built while collection was disabled.
     */
    extCssData?: ExtCssFrameData;

    /**
     * Whether to inject the rule set again when the current document already
     * holds it.
     */
    force?: boolean;
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
     * ExtendedCSS operations of frames without a frame context.
     *
     * Keyed by tab and frame, because such a frame has no document state to
     * keep the queue on. The entry is dropped when its last operation settles.
     */
    private static readonly contextFreeExtCssQueue = new Map<string, ExtCssInjectionChain>();

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
     * This is not a read-only getter: it also prepares and injects
     * ExtendedCSS. A frame without a prepared result is matched on demand, and
     * its ExtendedCSS rules are kept on the frame context. Once the app is
     * started, a frame without a context gets those rules injected from here,
     * and the method also calls {@link CosmeticApi.applyExtCss} for the frame.
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
            // ExtendedCss is injected by the background, but the marker state
            // is not reported back to the content script on MV2, so the value
            // means "marker state not reported by the background".
            extCssMarkersState: ExtCssMarkersState.ContentScript,
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

        data.nativeCssSelectors = CosmeticApi.getNativeCssSelectors(
            cosmeticResult,
            { isNativeHasSupported },
        );

        // A frame without a prepared result was matched on demand, so its
        // ExtendedCSS rules are extracted here. Keeping them on the context
        // stops the injection events that follow from rebuilding them.
        if (!frameContext?.preparedCosmeticResult) {
            const extCssRules = CosmeticApi.getExtCssRules(cosmeticResult, {
                areHitsStatsCollected,
                isNativeHasSupported,
            });

            if (frameContext) {
                tabsApi.updateFrameContext(tabId, frameId, {
                    extCssData: { extCssRules, areHitsStatsCollected },
                });
            } else if (isAppStarted && extCssRules) {
                // Nothing else reaches a frame without a context, so apply the
                // on-demand rules from here. Such a frame exists only during
                // startup, and the startup pass creates the contexts and
                // applies the rules, so waiting avoids re-sending the payload
                // on every content-script retry.
                CosmeticApi.injectExtCssWithoutContext(
                    tabId,
                    frameId,
                    extCssRules,
                    areHitsStatsCollected,
                );
            }
        }

        // The content script can ask after the frame's injection events have
        // already passed, e.g. for a page loaded while the app was stopped.
        // `applyExtCss` skips a document that already holds this rule set.
        if (isAppStarted) {
            CosmeticApi.applyExtCss(tabId, frameId);
        }

        return data;
    }

    /**
     * Re-applies marked CSS after collection is enabled on an open page.
     *
     * The original stylesheet and the ExtendedCss rules were applied without
     * markers when the page was loaded with collection disabled. Marked copies
     * are added, so filtering behavior is unchanged.
     *
     * MV2 injects ExtendedCss from the background, so the marked rules are
     * injected here too, and the injection is awaited before the content
     * script gets the response: the counter resumes only when the markers are
     * already in the document.
     *
     * @param frameUrl Frame url.
     * @param tabId Tab id.
     * @param frameId Frame id.
     *
     * @returns Content script data with the marked-data state.
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

        // The response belongs to the document the request came from. Every
        // await below can be overtaken by a navigation, which replaces the
        // context or bumps its version, so both are captured here.
        const documentVersion = frameContext?.extCssDocumentVersion;

        const cosmeticResult = frameContext?.cosmeticResult
            ?? engineApi.matchCosmetic(createFrameMatchQuery(frameUrl, frameId, tabContext));

        const isNativeHasSupported = CssCapabilities.isNativeHasPseudoClassSupported();

        data.extCssMarkersState = await CosmeticApi.reapplyMarkedExtCss(
            tabId,
            frameId,
            cosmeticResult,
            isNativeHasSupported,
        );

        // The marked rules were injected into the document that asked for
        // them. A navigation during the await means the new document gets its
        // own cosmetic data, so neither the old rules nor the old native CSS
        // describe it.
        if (CosmeticApi.hasFrameDocumentChanged(tabId, frameId, frameContext, documentVersion)) {
            data.areNativeHitsStatsCollected = false;
            data.extCssMarkersState = ExtCssMarkersState.NotRequired;

            return data;
        }

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

        let nativeResult: MarkedCssInjectionResult | 'failed';

        try {
            nativeResult = await CosmeticApi.injectMarkedCssWithRetries(
                tabId,
                frameId,
                cssText,
                frameContext,
                documentVersion,
            );
        } catch (e) {
            nativeResult = 'failed';
            logger.info(`[tsweb.CosmeticApi.reapplyMarkedCosmeticData]: error occurred during injection into tabId ${tabId} and frameId ${frameId} `, e);
        }

        // Both exits normalize a navigation the same way: the response belongs
        // to the document that sent the request, so a navigation during the
        // retries must not describe the new document.
        if (nativeResult === 'stale'
            || CosmeticApi.hasFrameDocumentChanged(tabId, frameId, frameContext, documentVersion)
        ) {
            data.areNativeHitsStatsCollected = false;
            data.extCssMarkersState = ExtCssMarkersState.NotRequired;

            return data;
        }

        if (nativeResult === 'failed') {
            // Marked ExtendedCss rules are still applied, but native hits
            // cannot be counted without this CSS.
            data.areNativeHitsStatsCollected = false;
            if (frameContext) {
                CosmeticApi.setNativeHitsMarkersApplied(
                    frameContext,
                    frameContext.preparedCosmeticResult,
                    false,
                );
            }

            return data;
        }

        data.areNativeHitsStatsCollected = true;
        if (frameContext) {
            CosmeticApi.setNativeHitsMarkersApplied(
                frameContext,
                frameContext.preparedCosmeticResult,
                true,
            );
            CosmeticApi.setMarkedCssInjected(frameContext, true);
        }

        return data;
    }

    /**
     * Checks whether the frame stopped describing the captured document.
     *
     * The response of a marked-data reapply belongs to the document that sent
     * the request. A navigation replaces the frame context or bumps its
     * document version, and the new document gets its own cosmetic data.
     *
     * A frame without a context cannot be observed for a navigation, so it is
     * never reported as changed.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param frameContext Frame context captured at entry, if any.
     * @param documentVersion Document version captured at entry, if any.
     *
     * @returns True when the captured document is no longer displayed.
     */
    private static hasFrameDocumentChanged(
        tabId: number,
        frameId: number,
        frameContext: FrameMV2 | undefined,
        documentVersion: number | undefined,
    ): boolean {
        if (!frameContext) {
            return false;
        }

        return tabsApi.getFrameContext(tabId, frameId) !== frameContext
            || frameContext.extCssDocumentVersion !== documentVersion;
    }

    /**
     * Injects the marked ExtendedCss rules of a document.
     *
     * The prepared rules were built while collection was disabled, so the
     * marked copy is built from the cosmetic result here. Ordinary
     * {@link CosmeticApi.applyExtCss} skips a document that already holds the
     * prepared rule set, so the injection is forced: the marked rules must
     * replace the unmarked instance.
     *
     * The injection is one complete operation: it starts after the queued
     * payload of the document, injects, awaits its retries and reports the
     * final outcome. The content script is running, so the document is ready
     * and no commit retry is needed.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param cosmeticResult Cosmetic result of the frame.
     * @param isNativeHasSupported Whether the browser supports the native
     * `:has` pseudo-class.
     *
     * @returns Marker state to report to the content script.
     */
    private static async reapplyMarkedExtCss(
        tabId: number,
        frameId: number,
        cosmeticResult: CosmeticResult,
        isNativeHasSupported: boolean,
    ): Promise<ExtCssMarkersState> {
        const extCssRules = CosmeticApi.getExtCssRules(cosmeticResult, {
            areHitsStatsCollected: true,
            isNativeHasSupported,
        });

        if (!extCssRules?.length) {
            // Nothing to mark in ExtendedCss, so every hit is a native one.
            return ExtCssMarkersState.Applied;
        }

        const frameContext = tabsApi.getFrameContext(tabId, frameId);

        if (!frameContext) {
            // An old subframe no longer has a context, so there is no document
            // state to record the injection against. The payload keeps its
            // instance and returns early for the same rules, so a repeated
            // call does not replace it. The retries belong to the call, so no
            // work is left behind after the response.
            const isApplied = await CosmeticApi.injectExtCssWithoutContext(
                tabId,
                frameId,
                extCssRules,
                true,
                true,
            );

            return isApplied
                ? ExtCssMarkersState.Applied
                : ExtCssMarkersState.Failed;
        }

        // The document already holds the marked rules, e.g. when the prepared
        // result was built with collection enabled, so there is nothing to
        // replace.
        if (CosmeticApi.isExtCssApplied(frameContext, extCssRules)) {
            return ExtCssMarkersState.Applied;
        }

        const isApplied = await CosmeticApi.applyExtCss(tabId, frameId, {
            extCssData: { extCssRules, areHitsStatsCollected: true },
            force: true,
        });

        return isApplied
            ? ExtCssMarkersState.Applied
            : ExtCssMarkersState.Failed;
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
            CosmeticApi.applyExtCss(tabId, frameId),
        ]).catch((e) => {
            logger.error('[tsweb.CosmeticApi.injectCosmetic]: error occurred during injection: ', e);
        });
    }

    /**
     * Tells whether another attempt of a failed injection cannot succeed.
     *
     * An engine guard failure is deterministic: the document has no engine or
     * a stale one, so a retry repeats it. So is a failure of an injection
     * whose frame context is gone, since the retry would apply the payload of
     * a replaced document.
     *
     * @param error Error thrown by the injection.
     * @param isTargetGone Whether the frame context the injection belongs to
     * is gone.
     *
     * @returns True if a retry cannot succeed.
     */
    private static isTerminalInjectionError(error: unknown, isTargetGone: () => boolean): boolean {
        return error instanceof ExtCssGuardError || isTargetGone();
    }

    /**
     * Runs an injection, retrying it after the retry timeout while attempts
     * remain.
     *
     * A terminal failure — an engine guard error or a gone frame context —
     * reaches {@link onFailure} right away, without spending the remaining
     * attempts.
     *
     * @param isTargetGone Tells whether the frame context the injection
     * belongs to is gone.
     * @param inject Injection to run.
     * @param retry Schedules the next attempt.
     * @param onFailure Handles the error of the last allowed attempt.
     * @param tries Number of the current attempt.
     * @param maxTries Number of the last allowed attempt. Zero allows a single
     * attempt without a retry.
     *
     * @returns True if the injection succeeded, otherwise false.
     */
    private static async injectWithRetry(
        isTargetGone: () => boolean,
        inject: () => Promise<void>,
        retry: () => void,
        onFailure: (error: unknown) => void,
        tries: number,
        maxTries = CosmeticApi.INJECTION_MAX_TRIES,
    ): Promise<boolean> {
        try {
            await inject();

            return true;
        } catch (e) {
            if (!CosmeticApi.isTerminalInjectionError(e, isTargetGone) && tries < maxTries) {
                setTimeout(retry, CosmeticApi.INJECTION_RETRY_TIMEOUT_MS);
            } else {
                onFailure(e);
            }

            return false;
        }
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

        await CosmeticApi.injectWithRetry(
            () => !tabsApi.getFrameContext(tabId, frameId),
            () => CosmeticApi.injectScript(tabId, frameId, scriptText),
            () => {
                CosmeticApi.applyJs(tabId, frameId, tries + 1);
            },
            (e) => {
                logger.debug('[tsweb.CosmeticApi.applyJs]: error occurred during injection', e);
            },
            tries,
        );
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
     * The marked CSS belongs to the captured document, so the frame context and
     * its document version are checked before every attempt: a navigation
     * replaces the context, and a same-URL reload keeps it and bumps the
     * version.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param cssText Marked CSS text.
     * @param frameContext Frame context that was matched for {@link cssText}.
     * @param documentVersion Number of the document {@link cssText} belongs
     * to.
     * @param tries Number of tries already made.
     *
     * @returns `injected` when the CSS reached the document, `stale` when the
     * captured document is no longer displayed.
     *
     * @throws The error of the last allowed attempt.
     */
    private static async injectMarkedCssWithRetries(
        tabId: number,
        frameId: number,
        cssText: string,
        frameContext: FrameMV2 | undefined,
        documentVersion: number | undefined,
        tries = 0,
    ): Promise<MarkedCssInjectionResult> {
        // The marked CSS belongs to the captured document. A navigation
        // replaces the frame context, and a same-URL reload keeps it and bumps
        // its version, so both are checked before every attempt.
        if (CosmeticApi.hasFrameDocumentChanged(tabId, frameId, frameContext, documentVersion)) {
            return 'stale';
        }

        try {
            await CosmeticApi.injectCss(tabId, frameId, cssText);

            return 'injected';
        } catch (e) {
            if (tries >= CosmeticApi.INJECTION_MAX_TRIES) {
                throw e;
            }

            await new Promise<void>((resolve) => {
                setTimeout(resolve, CosmeticApi.INJECTION_RETRY_TIMEOUT_MS);
            });

            return CosmeticApi.injectMarkedCssWithRetries(
                tabId,
                frameId,
                cssText,
                frameContext,
                documentVersion,
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

    /**
     * Applies or disposes ExtendedCSS in the specified tab and frame.
     *
     * The rules come from the frame's prepared result, or from the data kept
     * on the context when the frame was matched on demand. When they are
     * non-empty and the current document does not already hold that rule set,
     * the prebuilt engine script is injected first and the rule strings are
     * serialized into a code string and injected second. When the rule set is
     * empty or null, the dispose code string is injected once per document,
     * but only when the context may describe a document that holds an
     * instance: it applied one, or the startup pass created it. The dispose is
     * not retried, and the document is recorded as disposed even when the
     * attempt fails. Otherwise no code is injected.
     *
     * A context that describes a navigation that has not committed gets no
     * injection at all: the frame still shows the previous document, and the
     * commit handler injects the incoming document's rules once it is the
     * displayed one. The same check runs after the engine asset is injected,
     * because the frame may navigate while that call is in flight.
     *
     * An engine guard failure is terminal: the document has no engine or a
     * stale one, so the call is not retried and the failure is logged as an
     * error. Without `settings.extCssScriptUrl` the rules cannot be applied at
     * all, so the call reports a failure and injects nothing.
     *
     * The payload runs as one owned operation of the frame document queue: the
     * operation waits for the previous one to settle, retries inside itself and
     * stops as soon as a newer operation supersedes it.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param options ExtendedCSS data to inject instead of the prepared one,
     * and whether to inject it even when the document already holds it.
     *
     * @returns True when the document holds the requested ExtendedCSS state,
     * otherwise false.
     */
    public static async applyExtCss(
        tabId: number,
        frameId: number,
        options: ApplyExtCssOptions = {},
    ): Promise<boolean> {
        const frameContext = tabsApi.getFrameContext(tabId, frameId);

        if (!frameContext) {
            return false;
        }

        const documentVersion = frameContext.extCssDocumentVersion;

        if (frameContext.extCssAwaitingCommit) {
            return false;
        }

        const extCssData = options.extCssData ?? CosmeticApi.getExtCssData(frameContext);

        if (!extCssData) {
            return false;
        }

        const { extCssRules } = extCssData;

        // A payload for this document is already queued, so a second one would
        // send the same rules again. The forced marked reapply passes `force`,
        // because its payload differs from the queued one.
        if (!options.force && frameContext.extCssInjectionMarker === documentVersion) {
            return false;
        }

        // A dispose is a no-op in the page when the document holds no
        // instance, so it is attempted once.
        const maxTries = extCssRules?.length ? CosmeticApi.INJECTION_MAX_TRIES : 0;

        let code: string;
        let extCssScriptUrl: string | undefined;

        if (extCssRules?.length) {
            // A successful apply already put the same rule set into the page.
            // Serializing and parsing the code string again would only repeat
            // the in-page no-op. The marked-data reapply passes `force`,
            // because the marked copy must replace the unmarked instance even
            // though the prepared payload is the one on record.
            const marksWouldBeLost = frameContext.extCssHitsMarkersApplied
                && !extCssData.areHitsStatsCollected;

            if (!options.force
                && (marksWouldBeLost || CosmeticApi.isExtCssApplied(frameContext, extCssRules))
            ) {
                return true;
            }

            extCssScriptUrl = appContext.configuration?.settings.extCssScriptUrl;

            if (!extCssScriptUrl) {
                logger.error(`[tsweb.CosmeticApi.applyExtCss]: settings.extCssScriptUrl is not set, ExtendedCss rules are not applied in tabId ${tabId} and frameId ${frameId}`);

                return false;
            }

            code = serializeExtCssForCode(
                extCssRules,
                extCssData.areHitsStatsCollected,
                EXTCSS_PROTOCOL,
            );
        } else {
            // The document may hold an instance only when this context applied
            // one to it, or when the startup pass created the context for a
            // page that was already loaded. A context replaced for a
            // navigation that never commits describes no document of its own,
            // so it must not dispose the displayed page's instance.
            const mayHoldInstance = Boolean(frameContext.extCssAppliedData)
                || frameContext.extCssInstanceMayExist;

            if (!mayHoldInstance
                || frameContext.extCssDisposedDocumentVersion === documentVersion
            ) {
                return true;
            }

            code = serializeExtCssDisposeForCode(EXTCSS_PROTOCOL);
        }

        const queue = frameContext.extCssInjectionChain;
        const previous = queue?.documentVersion === documentVersion
            ? queue.current
            : undefined;

        // The newest payload supersedes the queued one, so it stops at its next
        // retry boundary instead of holding the queue.
        if (previous) {
            previous.superseded = true;
        }

        const { entry, result } = CosmeticApi.createExtCssOperation(
            options.force === true,
            async (isSuperseded) => {
                if (previous) {
                    // A failed previous payload must not block this one.
                    await previous.promise.catch(() => {});
                }

                return CosmeticApi.injectExtCssWithRetries(
                    tabId,
                    frameId,
                    code,
                    extCssScriptUrl,
                    isSuperseded,
                    () => tabsApi.getFrameContext(tabId, frameId) === frameContext
                        && frameContext.extCssDocumentVersion === documentVersion,
                    maxTries,
                );
            },
        );

        frameContext.extCssInjectionChain = { documentVersion, current: entry };
        frameContext.extCssInjectionMarker = documentVersion;

        const isInjected = await result;

        // Only the operation at the end of the queue describes the document: a
        // payload queued behind this one superseded it and decides the state.
        const ownsQueue = frameContext.extCssInjectionChain?.current === entry
            && frameContext.extCssInjectionChain.documentVersion === documentVersion;

        if (ownsQueue) {
            frameContext.extCssInjectionChain = undefined;
            frameContext.extCssInjectionMarker = undefined;
        }

        // The frame context is replaced on navigation, so a write to the
        // captured object would land on the discarded document. A commit of
        // the same frame keeps the context and bumps the document version, so
        // an injection started for the previous document records nothing.
        const isSameDocument = ownsQueue
            && tabsApi.getFrameContext(tabId, frameId) === frameContext
            && frameContext.extCssDocumentVersion === documentVersion;

        // A successful injection always leaves exactly one of the two markers
        // set: the document holds the applied rule set, or it was disposed. An
        // apply retires an earlier disposal and the other way around, so a
        // later change of the rule set is not skipped.
        if (isSameDocument) {
            if (extCssRules?.length) {
                // A failed apply records nothing, so a later event retries it.
                if (isInjected) {
                    frameContext.extCssAppliedData = extCssRules;
                    frameContext.extCssHitsMarkersApplied = extCssData.areHitsStatsCollected;
                    frameContext.extCssDisposedDocumentVersion = undefined;
                }
            } else {
                // A failed dispose is not retried, so the document is recorded
                // as disposed anyway: a second attempt would run with the same
                // permissions. An instance the document still holds is retired
                // on the next commit or when the context is recreated.
                frameContext.extCssAppliedData = undefined;
                frameContext.extCssHitsMarkersApplied = false;
                frameContext.extCssDisposedDocumentVersion = documentVersion;
            }
        }

        return isInjected;
    }

    /**
     * Creates an ExtendedCSS operation entry that records whether a newer
     * operation replaced it.
     *
     * @param priority Whether the operation injects a payload that must not be
     * replaced by an unmarked one.
     * @param operation Operation body, receiving the supersede check.
     *
     * @returns The queue entry and the promise of the operation result.
     */
    private static createExtCssOperation(
        priority: boolean,
        operation: (isSuperseded: () => boolean) => Promise<boolean>,
    ): { entry: ExtCssInjectionOperation; result: Promise<boolean> } {
        const entry: ExtCssInjectionOperation = {
            superseded: false,
            priority,
            promise: Promise.resolve(),
        };

        const result = operation(() => entry.superseded);
        entry.promise = result.then(() => undefined, () => undefined);

        return { entry, result };
    }

    /**
     * Injects one serialized payload, retrying transient failures inside the
     * owned operation.
     *
     * A retry never leaves the operation: a later retry could overtake a newer
     * payload, and the injected payload disposes the current instance before it
     * applies. The operation stops at a retry boundary when a newer operation
     * supersedes it or when the captured document is no longer displayed.
     *
     * The prebuilt engine script asset is injected before the rule strings, so
     * the payload carries only the rules. The engine has to be in the document
     * before its rules, so a retry repeats both injections: the file is
     * installed again and the code string applies the rules on top of it. The
     * apply code is executed through {@link CosmeticApi.injectExtCssCode},
     * which turns an in-page engine guard failure into an error. Such a failure
     * is terminal, so the attempt is not retried.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param code Serialized payload.
     * @param extCssScriptUrl Path to the prebuilt engine script asset, or
     * undefined for a dispose payload, which needs no engine.
     * @param isSuperseded Whether a newer operation replaced this one.
     * @param isDocumentDisplayed Whether the captured document is still
     * displayed in the frame.
     * @param maxTries Number of the last attempt. Zero allows a single
     * attempt.
     *
     * @returns True when the payload reached the page, otherwise false.
     */
    private static async injectExtCssWithRetries(
        tabId: number,
        frameId: number,
        code: string,
        extCssScriptUrl: string | undefined,
        isSuperseded: () => boolean,
        isDocumentDisplayed: () => boolean,
        maxTries: number,
    ): Promise<boolean> {
        for (let attempt = 0; ; attempt += 1) {
            if (isSuperseded() || !isDocumentDisplayed()) {
                return false;
            }

            try {
                if (extCssScriptUrl) {
                    // Retries are sequential by design: the next attempt must
                    // not start before this one fails.
                    // eslint-disable-next-line no-await-in-loop
                    await TabsApi.injectScriptFile(tabId, frameId, extCssScriptUrl);

                    // A cross-process navigation answers its injections in any
                    // order, so the frame may already show another document:
                    // that document may have applied its own rules while this
                    // asset call was in flight, and this rule set would replace
                    // them. Its own commit handler injects its rules, so this
                    // operation ends here.
                    if (isSuperseded() || !isDocumentDisplayed()) {
                        return false;
                    }

                    // eslint-disable-next-line no-await-in-loop
                    await CosmeticApi.injectExtCssCode(tabId, frameId, code);
                } else {
                    // eslint-disable-next-line no-await-in-loop
                    await TabsApi.injectScript(tabId, frameId, code);
                }

                return true;
            } catch (e) {
                // An engine guard failure is deterministic: the document has
                // no engine or a stale one, so a retry repeats it.
                if (e instanceof ExtCssGuardError) {
                    logger.error(`[tsweb.CosmeticApi.injectExtCssWithRetries]: ${e.message} (guard ${e.code}, tabId ${tabId}, frameId ${frameId})`);

                    return false;
                }

                // A document that is gone or no longer displayed cannot take
                // this payload any more, and a retry would apply the previous
                // document's rules elsewhere.
                if (!isDocumentDisplayed()) {
                    logger.debug(`[tsweb.CosmeticApi.injectExtCssWithRetries]: the document is no longer displayed, the injection is not retried in tabId ${tabId} and frameId ${frameId}`, e);

                    return false;
                }

                if (attempt >= maxTries) {
                    logger.debug(`[tsweb.CosmeticApi.injectExtCssWithRetries]: error occurred during ExtCSS injection into tabId ${tabId} and frameId ${frameId}`, e);

                    return false;
                }

                // eslint-disable-next-line no-await-in-loop
                await new Promise<void>((resolve) => {
                    setTimeout(resolve, CosmeticApi.INJECTION_RETRY_TIMEOUT_MS);
                });
            }
        }
    }

    /**
     * Checks whether the current document already holds the given ExtendedCSS
     * rule set.
     *
     * The rule set is compared by value: the on-demand path rebuilds the rule
     * strings on every request, so the same rules can arrive in a new array.
     * The hits statistics flag is not compared, because the payload's own
     * guard keeps its rule strings and skips any call with the same ones.
     *
     * @param frameContext Frame context.
     * @param extCssRules ExtendedCSS rule strings resolved for the frame now.
     *
     * @returns True if the document holds this rule set, otherwise false.
     */
    private static isExtCssApplied(frameContext: FrameMV2, extCssRules: string[]): boolean {
        const appliedRules = frameContext.extCssAppliedData;

        if (!appliedRules || appliedRules.length !== extCssRules.length) {
            return false;
        }

        return appliedRules.every((rule, index) => rule === extCssRules[index]);
    }

    /**
     * Injects ExtendedCSS rules into a frame that has no frame context.
     *
     * Such a frame has no document state to record the applied rules on, so it
     * has no frame queue either: the operations of the tab and frame are queued
     * here. A repeated call is a no-op in the page, because the payload returns
     * early when the retained instance has the same rules.
     *
     * Every call, retries included, runs inside one owned operation, so a retry
     * can never overtake a newer payload. A marked reapply supersedes the
     * queued payload, because the marked instance must not be replaced by an
     * unmarked copy.
     *
     * The prebuilt engine script asset is injected before the rule strings, and
     * the pair is repeated on a retry. A frame without a context cannot be
     * observed for a navigation: only a committed context that appears while
     * the asset call is in flight proves that the frame moved to another
     * document, and that document's own commit handler applies its rules.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param extCssRules Rule strings to inject.
     * @param areHitsStatsCollected Whether hits statistics are collected.
     * @param isPriority Whether the payload is a marked one that must not be
     * replaced by an unmarked payload.
     *
     * @returns True when the payload reached the page, otherwise false.
     */
    private static async injectExtCssWithoutContext(
        tabId: number,
        frameId: number,
        extCssRules: string[],
        areHitsStatsCollected: boolean,
        isPriority = false,
    ): Promise<boolean> {
        const extCssScriptUrl = appContext.configuration?.settings.extCssScriptUrl;

        if (!extCssScriptUrl) {
            logger.error(`[tsweb.CosmeticApi.injectExtCssWithoutContext]: settings.extCssScriptUrl is not set, ExtendedCss rules are not applied in tabId ${tabId} and frameId ${frameId}`);

            return false;
        }

        const code = serializeExtCssForCode(extCssRules, areHitsStatsCollected, EXTCSS_PROTOCOL);
        const key = CosmeticApi.getContextFreeExtCssKey(tabId, frameId);
        const queue = CosmeticApi.contextFreeExtCssQueue.get(key);
        const previous = queue?.current;

        // An unmarked payload must not supersede the marked instance that is
        // being applied: it would stop hit reporting until the next reapply.
        if (previous?.priority && !isPriority) {
            return false;
        }

        if (previous) {
            previous.superseded = true;
        }

        const { entry, result } = CosmeticApi.createExtCssOperation(
            isPriority,
            async (isSuperseded) => {
                if (previous) {
                    // A failed previous payload must not block this one.
                    await previous.promise.catch(() => {});
                }

                return CosmeticApi.injectExtCssWithRetries(
                    tabId,
                    frameId,
                    code,
                    extCssScriptUrl,
                    isSuperseded,
                    // A frame without a context cannot be observed for a
                    // navigation: only a committed context that appears while
                    // the asset call is in flight ends the operation, because
                    // that document's commit handler applies its own rules. A
                    // context that still awaits its commit describes a
                    // navigation that may never commit, so the previous
                    // document stays on screen and its rules still apply.
                    () => {
                        const currentContext = tabsApi.getFrameContext(tabId, frameId);

                        return !currentContext || currentContext.extCssAwaitingCommit;
                    },
                    CosmeticApi.INJECTION_MAX_TRIES,
                );
            },
        );

        CosmeticApi.contextFreeExtCssQueue.set(key, { documentVersion: 0, current: entry });

        const isInjected = await result;

        // The queue lives outside the frame context, so it is dropped when its
        // last operation settles.
        if (CosmeticApi.contextFreeExtCssQueue.get(key)?.current === entry) {
            CosmeticApi.contextFreeExtCssQueue.delete(key);
        }

        return isInjected;
    }

    /**
     * Returns the key of the context-free ExtendedCSS queue of a frame.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     *
     * @returns Queue key.
     */
    private static getContextFreeExtCssKey(tabId: number, frameId: number): string {
        return `${tabId}:${frameId}`;
    }

    /**
     * Injects a serialized ExtendedCss code string into a frame.
     *
     * The prebuilt engine asset must already be in the document: the payload
     * applies the rules through the engine the asset installs, and reports an
     * engine guard failure when it is missing or stale.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param code Serialized apply code string.
     *
     * @throws {ExtCssGuardError} If the injected apply function reports an
     * engine guard failure. Other in-page errors keep their existing behavior.
     */
    private static async injectExtCssCode(tabId: number, frameId: number, code: string): Promise<void> {
        const result = await TabsApi.injectScript<ExtCssApplyResult | undefined>(tabId, frameId, code);

        // Chromium resolves executeScript after an in-page exception, so only
        // the explicit engine guard result reaches this path.
        if (result) {
            throw new ExtCssGuardError(result);
        }
    }

    /**
     * Returns the ExtendedCSS data to apply for the frame.
     *
     * Frames precalculated by {@link CosmeticFrameProcessor} carry a prepared
     * result. Frames matched on demand by
     * {@link CosmeticApi.getContentScriptData} keep the extracted rules on the
     * context.
     *
     * @param frameContext Frame context.
     *
     * @returns ExtendedCSS data, or undefined when the frame has no cosmetic
     * data yet.
     */
    private static getExtCssData(frameContext: FrameMV2): ExtCssFrameData | undefined {
        const { preparedCosmeticResult, extCssData } = frameContext;

        if (preparedCosmeticResult) {
            const { extCssRules, areHitsStatsCollected } = preparedCosmeticResult;

            return { extCssRules, areHitsStatsCollected };
        }

        return extCssData;
    }
}

const cosmeticApi = new CosmeticApi();

export { cosmeticApi };
