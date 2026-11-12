import { type CosmeticResult, type CosmeticRule } from '@adguard/tsurlfilter';

import { USER_FILTER_ID } from '../../common/constants';
import { type ContentScriptCosmeticData, CosmeticApiCommon, type LogJsRulesParams } from '../../common/cosmetic-api';
import { ExtCssGuardError } from '../../common/extcss-guard-error';
import { EXTCSS_PROTOCOL, type ExtCssApplyResult } from '../../common/extcss-protocol';
import { createFrameMatchQuery } from '../../common/utils/create-frame-match-query';
import { CssCapabilities } from '../../common/utils/css-capabilities';
import { logger } from '../../common/utils/logger';

import { engineApi, tabsApi } from './api';
import { appContext } from './app-context';
import { serializeExtCssDisposeForCode, serializeExtCssForCode } from './extcss-code';
import { buildScriptText, InjectionGuard } from './injection-helper';
import { localScriptRulesService } from './services/local-script-rules-service';
import { type ExtCssFrameData, type FrameMV2 } from './tabs/frame';
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

        let cosmeticResult;

        const frameContext = tabsApi.getFrameContext(tabId, frameId);
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
     * Runs an injection, retrying it after the retry timeout while attempts
     * remain.
     *
     * An engine guard failure is terminal: the document has no engine or a
     * stale one, so another attempt would repeat the same deterministic
     * failure. It reaches {@link onFailure} right away, without spending the
     * remaining attempts.
     *
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
            if (!(e instanceof ExtCssGuardError) && tries < maxTries) {
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
     * Injects css to specified tab id and frame id.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param tries Number of tries for the injection in case of failure.
     */
    public static async applyCss(tabId: number, frameId: number, tries = 0): Promise<void> {
        const frameContext = tabsApi.getFrameContext(tabId, frameId);

        const cssText = frameContext?.preparedCosmeticResult?.cssText;
        if (!cssText) {
            return;
        }

        await CosmeticApi.injectWithRetry(
            () => CosmeticApi.injectCss(tabId, frameId, cssText),
            () => {
                CosmeticApi.applyCss(tabId, frameId, tries + 1);
            },
            (e) => {
                logger.debug('[tsweb.CosmeticApi.applyCss]: error occurred during injection', e);
            },
            tries,
        );
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
     * error.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param tries Number of tries for the injection in case of failure.
     * @param documentVersion Number of the document the retry chain belongs
     * to. The chain ends when the context has moved to another document.
     */
    public static async applyExtCss(
        tabId: number,
        frameId: number,
        tries = 0,
        documentVersion?: number,
    ): Promise<void> {
        const frameContext = tabsApi.getFrameContext(tabId, frameId);

        if (!frameContext) {
            return;
        }

        const { extCssDocumentVersion } = frameContext;

        // A retry belongs to the document it was scheduled for: a commit
        // since then starts its own chain from the commit handler, so this
        // one must not send the previous document's payload next to it.
        if (tries > 0 && documentVersion !== extCssDocumentVersion) {
            return;
        }

        if (frameContext.extCssAwaitingCommit) {
            return;
        }

        const extCssData = CosmeticApi.getExtCssData(frameContext);

        if (!extCssData) {
            return;
        }

        const { extCssRules } = extCssData;

        // An injection for this document is already in flight, so a second one
        // would send the same payload again and start its own retry chain. A
        // retry continues the chain it belongs to and passes this check.
        if (tries === 0
            && frameContext.extCssInjectionMarker === extCssDocumentVersion
        ) {
            return;
        }

        // A dispose is a no-op in the page when the document holds no
        // instance, so it is attempted once: a chain of failed injections
        // would have no better chance, and the document is recorded as
        // disposed even when the attempt fails.
        const maxTries = extCssRules?.length ? CosmeticApi.INJECTION_MAX_TRIES : 0;

        let code: string;
        let extCssScriptUrl: string | undefined;

        if (extCssRules?.length) {
            // A successful apply already put the same rule set into the page.
            // Serializing and parsing the code string again would only repeat
            // the in-page no-op.
            if (CosmeticApi.isExtCssApplied(frameContext, extCssRules)) {
                CosmeticApi.releaseExtCssInjectionMarker(frameContext, extCssDocumentVersion);

                return;
            }

            extCssScriptUrl = appContext.configuration?.settings.extCssScriptUrl;

            if (!extCssScriptUrl) {
                logger.error(`[tsweb.CosmeticApi.applyExtCss]: settings.extCssScriptUrl is not set, ExtendedCss rules are not applied in tabId ${tabId} and frameId ${frameId}`);

                return;
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
                || frameContext.extCssDisposedDocumentVersion === extCssDocumentVersion
            ) {
                CosmeticApi.releaseExtCssInjectionMarker(frameContext, extCssDocumentVersion);

                return;
            }

            code = serializeExtCssDisposeForCode(EXTCSS_PROTOCOL);
        }

        frameContext.extCssInjectionMarker = extCssDocumentVersion;

        // The engine has to be in the document before its rules, so a retry
        // repeats both injections: the file is a cheap no-op that reinstalls
        // the engine, and the code string applies the rules on top of it.
        const inject = extCssScriptUrl
            ? async (): Promise<void> => {
                await TabsApi.injectScriptFile(tabId, frameId, extCssScriptUrl);

                // A cross-process navigation answers its injections in any
                // order, so the frame may already show another document: that
                // document may have applied its own rules while this asset
                // call was in flight, and this rule set would replace them.
                // Its own commit handler injects its rules, so this chain ends.
                if (tabsApi.getFrameContext(tabId, frameId) !== frameContext
                    || frameContext.extCssDocumentVersion !== extCssDocumentVersion
                ) {
                    return;
                }

                await CosmeticApi.injectExtCssCode(tabId, frameId, code);
            }
            : (): Promise<void> => TabsApi.injectScript(tabId, frameId, code);

        // A terminal guard failure reports right away, so the call ends here
        // even though the retry budget is not spent.
        let isTerminalFailure = false;

        const isInjected = await CosmeticApi.injectWithRetry(
            inject,
            () => {
                CosmeticApi.applyExtCss(tabId, frameId, tries + 1, extCssDocumentVersion);
            },
            (e) => {
                if (e instanceof ExtCssGuardError) {
                    isTerminalFailure = true;
                    logger.error(`[tsweb.CosmeticApi.applyExtCss]: ${e.message} (guard ${e.code}, tabId ${tabId}, frameId ${frameId})`);

                    return;
                }

                logger.debug(`[tsweb.CosmeticApi.applyExtCss]: error occurred during injection into tabId ${tabId} and frameId ${frameId}`, e);
            },
            tries,
            maxTries,
        );

        // Keep the marker until the chain ends: a failed attempt schedules its
        // retry after a delay, and an event arriving in that gap must not start
        // a second chain. The last attempt has no retry, and neither has a
        // terminal guard failure, so both clear the marker and let a later
        // event try again.
        if (frameContext.extCssInjectionMarker === extCssDocumentVersion
            && (isInjected || isTerminalFailure || tries >= maxTries)
        ) {
            frameContext.extCssInjectionMarker = undefined;
        }

        // The frame context is replaced on navigation, so a write to the
        // captured object would land on the discarded document. A commit of
        // the same frame keeps the context and bumps the document version, so
        // an injection started for the previous document records nothing.
        const isSameDocument = tabsApi.getFrameContext(tabId, frameId) === frameContext
            && frameContext.extCssDocumentVersion === extCssDocumentVersion;

        // A successful injection always leaves exactly one of the two markers
        // set: the document holds the applied rule set, or it was disposed. An
        // apply retires an earlier disposal and the other way around, so a
        // later change of the rule set is not skipped.
        if (isSameDocument) {
            if (extCssRules?.length) {
                // A failed apply records nothing, so a later event retries it.
                if (isInjected) {
                    frameContext.extCssAppliedData = extCssRules;
                    frameContext.extCssDisposedDocumentVersion = undefined;
                }
            } else {
                // A failed dispose is not retried, so the document is recorded
                // as disposed anyway: a second attempt would run with the same
                // permissions. An instance the document still holds is retired
                // on the next commit or when the context is recreated.
                frameContext.extCssAppliedData = undefined;
                frameContext.extCssDisposedDocumentVersion = extCssDocumentVersion;
            }
        }
    }

    /**
     * Releases the in-flight marker when the given call owns it.
     *
     * A retry that ends for a reason other than an injection result, such as
     * a rule set that is already applied, would otherwise leave the marker set
     * and skip every later event for the document.
     *
     * @param frameContext Frame context.
     * @param documentVersion Number of the document the call belongs to.
     */
    private static releaseExtCssInjectionMarker(
        frameContext: FrameMV2,
        documentVersion: number,
    ): void {
        if (frameContext.extCssInjectionMarker === documentVersion) {
            frameContext.extCssInjectionMarker = undefined;
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
     * Such a frame has no document state to record the applied rules on, so
     * the shared retry budget is the only protection against a transient
     * injection failure. A repeated call is a no-op in the page, because the
     * payload returns early when the retained instance has the same rules.
     * The prebuilt engine script is injected before the rule strings, and the
     * pair is repeated on a retry.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param extCssRules Rule strings to inject.
     * @param areHitsStatsCollected Whether hits statistics are collected.
     * @param tries Number of tries for the injection in case of failure.
     */
    private static async injectExtCssWithoutContext(
        tabId: number,
        frameId: number,
        extCssRules: string[],
        areHitsStatsCollected: boolean,
        tries = 0,
    ): Promise<void> {
        const extCssScriptUrl = appContext.configuration?.settings.extCssScriptUrl;

        if (!extCssScriptUrl) {
            logger.error(`[tsweb.CosmeticApi.injectExtCssWithoutContext]: settings.extCssScriptUrl is not set, ExtendedCss rules are not applied in tabId ${tabId} and frameId ${frameId}`);

            return;
        }

        const code = serializeExtCssForCode(extCssRules, areHitsStatsCollected, EXTCSS_PROTOCOL);

        await CosmeticApi.injectWithRetry(
            async () => {
                await TabsApi.injectScriptFile(tabId, frameId, extCssScriptUrl);

                // The frame committed a document of its own while the asset
                // call was in flight, and that document's commit handler
                // applies its own rules. A context that shows up here means
                // such a commit happened, so this rule set belongs to the
                // previous document and must not replace the new one.
                if (tabsApi.getFrameContext(tabId, frameId)) {
                    return;
                }

                await CosmeticApi.injectExtCssCode(tabId, frameId, code);
            },
            () => {
                CosmeticApi.injectExtCssWithoutContext(
                    tabId,
                    frameId,
                    extCssRules,
                    areHitsStatsCollected,
                    tries + 1,
                );
            },
            (e) => {
                if (e instanceof ExtCssGuardError) {
                    logger.error(`[tsweb.CosmeticApi.injectExtCssWithoutContext]: ${e.message} (guard ${e.code}, tabId ${tabId}, frameId ${frameId})`);

                    return;
                }

                logger.debug(`[tsweb.CosmeticApi.injectExtCssWithoutContext]: error occurred during ExtCSS injection into tabId ${tabId} and frameId ${frameId}`, e);
            },
            tries,
        );
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
