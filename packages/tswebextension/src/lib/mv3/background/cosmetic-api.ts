import { type CosmeticRule, type ScriptletData } from '@adguard/tsurlfilter';

import { isCollectStatsEnabledForDocument } from '../../common/collect-hit-stats';
import { BACKGROUND_TAB_ID } from '../../common/constants';
import {
    type ContentScriptCosmeticData,
    CosmeticApiCommon,
    ExtCssMarkersState,
    type LogJsRulesParams,
    type MarkedCssFrameContext,
} from '../../common/cosmetic-api';
import { createFrameMatchQuery } from '../../common/utils/create-frame-match-query';
import { logger } from '../../common/utils/logger';
import { getDomain, isExtensionUrl } from '../../common/utils/url';
import { type FrameMV3, type PreparedCosmeticResultMV3 } from '../tabs/frame';
import { tabsApi } from '../tabs/tabs-api';

import { appContext } from './app-context';
import { engineApi } from './engine-api';
import { type ExecuteExtCssTarget, ScriptingApi } from './scripting-api';
import { localScriptRulesService } from './services/local-script-rules-service';
import { UserScriptsApi } from './user-scripts-api';

/**
 * Data for JS and scriptlets rules for MV3.
 */
type ScriptsAndScriptletsDataMv3 = {
    /**
     * Script texts from JS rules.
     */
    scriptTexts: string[];

    /**
     * List of scriptlet data objects.
     */
    scriptletDataList: ScriptletData[];
};

type LogJsRulesParamsMv3 = LogJsRulesParams & {
    /**
     * Computed result which prepared for injection.
     */
    preparedCosmeticResult: PreparedCosmeticResultMV3;
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
     * Max number of tries to inject a marked stylesheet.
     */
    private static readonly INJECTION_MAX_TRIES = 100;

    /**
     * Actual marked ExtendedCss state per frame context.
     */
    protected static extCssMarkersApplied = new WeakMap<object, {
        preparedCosmeticResult: PreparedCosmeticResultMV3 | undefined;
        applied: boolean;
    }>();

    /**
     * Waits for a marked native CSS injection that is still in progress.
     *
     * ExtendedCss is deliberately not awaited here: its payload is large and
     * compiled in every matched frame, so making the ordinary cosmetic data
     * response wait for it would block the content script. Only the marked
     * re-apply waits for a pending ExtendedCss injection, because it replaces
     * the same document's instance.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param documentId Document the request came from, when known. Defaults to
     * the document the frame context holds.
     *
     * @returns A promise that resolves when the pending injection settles.
     */
    public static waitForPendingCssInjection(
        tabId: number,
        frameId: number,
        documentId?: string,
    ): Promise<void> {
        return CosmeticApiCommon.waitForPendingCssInjectionForContext(
            tabsApi.getFrameContext(tabId, frameId),
            documentId,
        );
    }

    /**
     * Records whether marked ExtendedCss rules are applied for a frame.
     *
     * @param frameContext Frame context.
     * @param preparedCosmeticResult Prepared result used for the frame.
     * @param applied Whether the marked ExtendedCss rules are applied.
     */
    protected static setExtCssMarkersApplied(
        frameContext: object,
        preparedCosmeticResult: PreparedCosmeticResultMV3 | undefined,
        applied: boolean,
    ): void {
        CosmeticApi.extCssMarkersApplied.set(frameContext, {
            preparedCosmeticResult,
            applied,
        });
    }

    /**
     * This is STEP 3: All previously matched script rules are processed and filtered:
     * Scriptlet and JS rules from pre-built filters (previously collected, pre-built and passed to the engine)
     * are going to be executed as functions via chrome.scripting API,
     * or userScripts API if User scripts API permission is explicitly granted.
     *
     * The whole process is explained below.
     *
     * To fully comply with Chrome Web Store policies regarding remote code execution,
     * we implement a strict security-focused approach for Scriptlet and JavaScript rules execution.
     *
     * 1. Default - regular users that did not grant User scripts API permission explicitly:
     *    - We collect and pre-build script rules from the filters and statically bundle
     *      them into the extension - STEP 1. See 'updateLocalResourcesForMv3' in our build tools.
     *      IMPORTANT: all scripts and their arguments are local and bundled within the extension.
     *    - These pre-verified local scripts are passed to the engine - STEP 2.
     *    - At runtime before the execution, we check if each script rule is included
     *      in our local scripts list (STEP 3).
     *    - Only pre-verified local scripts are executed via chrome.scripting API (STEP 4.1 and 4.2).
     *      All other scripts are discarded.
     *    - Custom filters are NOT allowed for regular users to prevent any possibility
     *      of remote code execution, regardless of rule interpretation.
     *
     * 2. For advanced users that explicitly granted User scripts API permission -
     *    via enabling the Developer mode or Allow user scripts in the extension details:
     *    - Custom filters are allowed and may contain Scriptlet and JS rules
     *      that can be executed using the browser's built-in userScripts API (STEP 4.3),
     *      which provides a secure sandbox.
     *    - This execution bypasses the local script verification process but remains
     *      isolated and secure through Chrome's native sandboxing.
     *    - This mode requires explicit user activation and is intended for advanced users only.
     *
     * IMPORTANT:
     * Custom filters are ONLY supported when User scripts API permission is explicitly enabled.
     * This strict policy prevents Chrome Web Store rejection due to potential remote script execution.
     * When custom filters are allowed, they may contain:
     * 1. Network rules – converted to DNR rules and applied via dynamic rules.
     * 2. Cosmetic rules – interpreted directly in the extension code.
     * 3. Scriptlet and JS rules – executed via the browser's userScripts API (userScripts.execute)
     *    with Chrome's native sandboxing providing security isolation.
     *
     * For regular users without User scripts API permission (default case):
     * - Only pre-bundled filters with statically verified scripts are supported.
     * - Downloading custom filters or any rules from remote sources is blocked entirely
     *   to ensure compliance with the store policies.
     *
     * This implementation ensures perfect compliance with Chrome Web Store policies
     * by preventing any possibility of remote code execution for regular users.
     *
     * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
     */
    /**
     * Generates data for scriptlets and local scripts:
     * - functions for scriptlets,
     * - script texts for JS rules from pre-built filters.
     *
     * @param rules Cosmetic rules.
     *
     * @returns An object with data for scriptlets and script texts.
     */
    public static getScriptsAndScriptletsData(rules: CosmeticRule[]): ScriptsAndScriptletsDataMv3 {
        if (rules.length === 0) {
            return {
                scriptTexts: [],
                scriptletDataList: [],
            };
        }

        const uniqueScriptTexts = new Set<string>();
        const scriptletDataList = [];

        for (let i = 0; i < rules.length; i += 1) {
            const rule = rules[i];

            if (rule.isScriptlet) {
                const scriptletData = rule.getScriptletData();

                if (scriptletData) {
                    scriptletDataList.push(scriptletData);
                }
            } else {
                // TODO: Optimize script injection by checking if common scripts (e.g., AG_)
                //  are actually used in the rules. If not, avoid injecting them to reduce overhead.

                const ruleScriptText = rule.getContent();
                if (ruleScriptText) {
                    uniqueScriptTexts.add(ruleScriptText);
                }
            }
        }

        return {
            scriptTexts: [...uniqueScriptTexts],
            scriptletDataList,
        };
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
        if (rules.length === 0) {
            return '';
        }

        const uniqueScriptStrings = new Set<string>();

        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2584
        const debug = appContext?.configuration?.settings?.debugScriptlets;

        const scriptParams = {
            debug,
            frameUrl,
        };

        rules.forEach((rule) => {
            const scriptStr = rule.getScript(scriptParams);
            if (scriptStr) {
                uniqueScriptStrings.add(scriptStr);
            }
        });

        const scriptText = CosmeticApi.combineScripts(uniqueScriptStrings);

        return CosmeticApi.wrapScriptText(scriptText);
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
        const data: ContentScriptCosmeticData = {
            isAppStarted: false,
            areHitsStatsCollected: false,
            areNativeHitsStatsCollected: false,
            extCssMarkersState: ExtCssMarkersState.NotRequired,
            extCssRules: null,
            nativeCssSelectors: null,
        };

        // if storage is not initialized, then app is not ready yet.
        if (!appContext.isStorageInitialized) {
            return data;
        }

        const { isAppStarted } = appContext;

        data.isAppStarted = isAppStarted;

        // The content script needs this flag to decide whether to create its
        // native-only CssHitsCounter (it reads the `--adguard-hit` markers
        // the background adds to native CSS when statistics are enabled).
        const areHitsStatsCollected = appContext.configuration?.settings.collectStats || false;

        // Compute the flag before the tab context check to avoid a startup
        // race: while the tab context does not exist yet, the response already
        // carries `isAppStarted: true`, and a `false` here would be treated as
        // final by the content script's retry loop, so it would never create
        // the counter for this document. The allowlist cannot be evaluated
        // without the tab context, so the counter may be created on an
        // allowlisted page; it produces no hits there because no markers are
        // emitted for such pages.
        data.areHitsStatsCollected = areHitsStatsCollected;

        const tabContext = tabsApi.getTabContext(tabId);

        if (!tabContext?.info.url) {
            return data;
        }

        // Do not collect hits stats if website is allowlisted
        const effectiveCollectStats = isCollectStatsEnabledForDocument(
            areHitsStatsCollected,
            tabContext.mainFrameRule,
        );

        data.areHitsStatsCollected = effectiveCollectStats;
        const frameContext = tabsApi.getFrameContext(tabId, frameId);
        const nativeHitsState = frameContext
            ? CosmeticApi.nativeHitsMarkersApplied.get(frameContext)
            : undefined;
        data.areNativeHitsStatsCollected = !!nativeHitsState?.applied
            && nativeHitsState.preparedCosmeticResult === frameContext?.preparedCosmeticResult;

        // The ExtendedCss rules are prepared and applied by the background, so
        // only its record of the last injection can tell whether the marked
        // rules reached this document.
        const extCssState = frameContext
            ? CosmeticApi.extCssMarkersApplied.get(frameContext)
            : undefined;
        if (frameContext
            && extCssState
            && extCssState.preparedCosmeticResult === frameContext.preparedCosmeticResult) {
            data.extCssMarkersState = extCssState.applied
                ? ExtCssMarkersState.Applied
                : ExtCssMarkersState.Failed;
        }

        const matchQuery = createFrameMatchQuery(frameUrl, frameId, tabContext);

        const cosmeticResult = engineApi.matchCosmetic(matchQuery);

        // `extCssRules` stays `null`: ExtendedCss is applied from the
        // background service worker via `ScriptingApi.executeExtCss`, so the
        // content script never instantiates the engine.
        data.nativeCssSelectors = CosmeticApi.getNativeCssSelectors(
            cosmeticResult,
            { isNativeHasSupported: true },
        );

        return data;
    }

    /**
     * Re-applies marked CSS after collection is enabled on an open page.
     *
     * The original stylesheet and the ExtendedCss rules were applied without
     * markers when the page was loaded with collection disabled. Marked copies
     * are added, so filtering behavior is unchanged.
     *
     * Both marked injections are bound to the document the request came from:
     * the sender reports it, and the frame context may already describe the
     * next document after a navigation.
     *
     * @param frameUrl Frame url.
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param targetDocumentId Document the request came from, when known.
     *
     * @returns Content script data for the frame.
     */
    public static async reapplyMarkedCosmeticData(
        frameUrl: string,
        tabId: number,
        frameId: number,
        targetDocumentId?: string,
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

        // The rules must reach the document the sender runs in. The id is
        // captured once, because a navigation mutates the frame context in
        // place while the injections below are awaited; an operation whose
        // frame context already describes another document is rejected
        // instead of injected into the wrong one.
        const documentId = targetDocumentId ?? frameContext?.documentId;

        // The seeded marker state describes the document the frame context
        // holds. A request from another document must report its own state, so
        // the context's state is cleared instead of passed through to the
        // response.
        if (frameContext?.documentId !== documentId) {
            data.areNativeHitsStatsCollected = false;
            data.extCssMarkersState = ExtCssMarkersState.NotRequired;
        }

        // The marked CSS cache and the marker records are keyed by the frame
        // context and store its document id, so they can describe only that
        // document.
        let recordsFrameContext = CosmeticApi.getRecordsFrameContext(frameContext, documentId);

        // The frame context is only an injection cache key. Old subframes no
        // longer have one, so match from the frame URL and tab context.
        if (recordsFrameContext && CosmeticApi.hasMarkedCssInjected(recordsFrameContext)) {
            data.areNativeHitsStatsCollected = true;
            CosmeticApi.setNativeHitsMarkersApplied(
                recordsFrameContext,
                recordsFrameContext.preparedCosmeticResult,
                true,
            );

            const { preparedCosmeticResult } = recordsFrameContext;
            const extCssState = CosmeticApi.extCssMarkersApplied.get(recordsFrameContext);

            // The cache can be written by the initial marked CSS injection
            // before the floating ExtendedCss injection settles, so a cache
            // hit alone does not prove that the marked ExtendedCss rules were
            // applied. Only a success record for this prepared result does,
            // while a missing record means the injection is still pending.
            const areExtCssMarkersApplied = extCssState?.preparedCosmeticResult
                === preparedCosmeticResult
                && extCssState?.applied === true;

            if (preparedCosmeticResult && !areExtCssMarkersApplied) {
                // The unmarked instance may still be applying; the marked
                // rules replace it, so the queue orders them instead of racing
                // it.
                let extCssApplied = false;
                const injected = await CosmeticApi.runQueuedExtCssOperation({
                    frameContext: recordsFrameContext,
                    documentId,
                    preparedCosmeticResult,
                    operation: async () => {
                        // A predecessor that applied the same prepared result
                        // left a success record: replacing the instance would
                        // only duplicate it.
                        const injectedFrameContext = CosmeticApi.getRecordsFrameContext(
                            frameContext,
                            documentId,
                        );
                        const injectedExtCssState = injectedFrameContext
                            ? CosmeticApi.extCssMarkersApplied.get(injectedFrameContext)
                            : undefined;
                        if (injectedFrameContext
                            && injectedExtCssState?.preparedCosmeticResult
                                === preparedCosmeticResult
                            && injectedExtCssState.applied) {
                            extCssApplied = true;
                            return;
                        }

                        extCssApplied = await CosmeticApi.injectExtCssRules(
                            { tabId, frameId, documentId },
                            preparedCosmeticResult.extCssRules,
                            preparedCosmeticResult.areHitsStatsCollected,
                        );

                        const recordedFrameContext = CosmeticApi.getRecordsFrameContext(
                            frameContext,
                            documentId,
                        );
                        if (!recordedFrameContext) {
                            return;
                        }

                        CosmeticApi.setExtCssMarkersApplied(
                            recordedFrameContext,
                            preparedCosmeticResult,
                            extCssApplied,
                        );

                        if (extCssApplied) {
                            CosmeticApi.setMarkedCssInjected(recordedFrameContext);
                        }
                    },
                });

                // The frame moved on to another document while the queue
                // settled, so the request describes a document the frame
                // context no longer holds.
                if (!injected) {
                    return data;
                }

                data.extCssMarkersState = extCssApplied
                    ? ExtCssMarkersState.Applied
                    : ExtCssMarkersState.Failed;

                return data;
            }

            // The marked native CSS is in place and no failed ExtendedCss
            // injection is recorded for this prepared result.
            data.extCssMarkersState = ExtCssMarkersState.Applied;
            return data;
        }

        const cosmeticResult = engineApi.matchCosmetic(
            createFrameMatchQuery(frameUrl, frameId, tabContext),
        );

        // The ExtendedCss rules prepared for this document were built without
        // hit markers, and MV3 applies the engine from the background, so the
        // marked rules must be injected here: the content script does not
        // receive them and has nothing to re-apply.
        const extCssRules = CosmeticApi.getExtCssRules(cosmeticResult, {
            areHitsStatsCollected: true,
            isNativeHasSupported: true,
        });

        // The initial operation is left floating, so it may still be applying
        // the unmarked rules to this document. The marked rules replace the
        // document's ExtendedCss instance, so the queue orders them instead of
        // racing it, even when the prepared result differs.
        //
        // The rules matched above belong to the captured document, so the
        // operation is bound to its id: a navigation during the queue makes it
        // stop instead of applying the rules to the next document.
        const queuedPreparedCosmeticResult = CosmeticApi.getRecordsFrameContext(
            frameContext,
            documentId,
        )?.preparedCosmeticResult;

        let extCssApplied = false;
        const injected = await CosmeticApi.runQueuedExtCssOperation({
            frameContext,
            documentId,
            preparedCosmeticResult: queuedPreparedCosmeticResult,
            operation: async () => {
                // The queue only orders the operations. An operation that
                // already carried markers for this prepared result applied the
                // same rules, so injecting them again would replace an
                // identical instance. An unmarked operation still needs the
                // marked replacement.
                const injectedFrameContext = CosmeticApi.getRecordsFrameContext(
                    frameContext,
                    documentId,
                );
                const extCssState = injectedFrameContext
                    ? CosmeticApi.extCssMarkersApplied.get(injectedFrameContext)
                    : undefined;
                const areExtCssMarkersApplied = !!injectedFrameContext
                    && extCssState?.applied === true
                    && extCssState.preparedCosmeticResult
                        === injectedFrameContext.preparedCosmeticResult
                    && injectedFrameContext.preparedCosmeticResult?.areHitsStatsCollected
                        === true;

                extCssApplied = areExtCssMarkersApplied
                    ? true
                    : await CosmeticApi.injectExtCssRules(
                        { tabId, frameId, documentId },
                        extCssRules,
                        true,
                    );

                // The records describe the injected document, so they are
                // written only while the frame context still holds it.
                if (injectedFrameContext) {
                    CosmeticApi.setExtCssMarkersApplied(
                        injectedFrameContext,
                        injectedFrameContext.preparedCosmeticResult,
                        extCssApplied,
                    );
                }
            },
        });

        // The frame moved on to another document while the queue settled, so
        // the rules matched for the captured document must not be injected.
        if (!injected) {
            return data;
        }

        data.extCssMarkersState = extCssApplied
            ? ExtCssMarkersState.Applied
            : ExtCssMarkersState.Failed;

        recordsFrameContext = CosmeticApi.getRecordsFrameContext(frameContext, documentId);

        const cssText = CosmeticApi.getCssText(cosmeticResult, {
            areHitsStatsCollected: true,
            isNativeHasSupported: true,
        });

        if (!cssText) {
            // There is no native CSS to inject, so no native hit can be lost.
            data.areNativeHitsStatsCollected = true;
            if (recordsFrameContext) {
                CosmeticApi.setNativeHitsMarkersApplied(
                    recordsFrameContext,
                    recordsFrameContext.preparedCosmeticResult,
                    true,
                );
                // The cache is written only when both marked parts succeeded,
                // so a failed ExtendedCss injection is retried on the next
                // enable.
                if (extCssApplied) {
                    CosmeticApi.setMarkedCssInjected(recordsFrameContext);
                }
            }
            return data;
        }

        // The cache is written only when both marked parts succeeded, so a
        // failed ExtendedCss injection leaves the marked native CSS in the
        // document while the cache stays unwritten. Injecting it again would
        // duplicate the stylesheet.
        const nativeHitsState = recordsFrameContext
            ? CosmeticApi.nativeHitsMarkersApplied.get(recordsFrameContext)
            : undefined;
        if (recordsFrameContext
            && nativeHitsState?.applied
            && nativeHitsState.preparedCosmeticResult === recordsFrameContext.preparedCosmeticResult) {
            data.areNativeHitsStatsCollected = true;
            if (extCssApplied) {
                CosmeticApi.setMarkedCssInjected(recordsFrameContext);
            }
            return data;
        }

        try {
            await CosmeticApi.injectMarkedCssWithRetries(
                tabId,
                frameId,
                cssText,
                documentId,
                frameContext,
            );
            data.areNativeHitsStatsCollected = true;
            recordsFrameContext = CosmeticApi.getRecordsFrameContext(frameContext, documentId);
            if (recordsFrameContext) {
                CosmeticApi.setNativeHitsMarkersApplied(
                    recordsFrameContext,
                    recordsFrameContext.preparedCosmeticResult,
                    true,
                );
                if (extCssApplied) {
                    CosmeticApi.setMarkedCssInjected(recordsFrameContext);
                }
            }
        } catch (e) {
            // Marked ExtendedCss rules are still applied by the content
            // script, but native hits cannot be counted without this CSS.
            data.areNativeHitsStatsCollected = false;
            recordsFrameContext = CosmeticApi.getRecordsFrameContext(frameContext, documentId);
            if (recordsFrameContext) {
                CosmeticApi.setNativeHitsMarkersApplied(
                    recordsFrameContext,
                    recordsFrameContext.preparedCosmeticResult,
                    false,
                );
            }
            logger.info(`[tsweb.CosmeticApi.reapplyMarkedCosmeticData]: error occurred during injection into tabId ${tabId} and frameId ${frameId} `, e);
        }

        return data;
    }

    /**
     * Injects JS to specified tab and frame.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param scriptTexts Script texts to inject.
     *
     * @returns A promise that resolves when the JS is injected.
     */
    private static async applyJsFuncs(
        tabId: number,
        frameId: number,
        scriptTexts: string[] = [],
    ): Promise<void> {
        if (scriptTexts.length === 0) {
            return;
        }

        const tasks = scriptTexts.map(async (scriptText): Promise<void> => {
            /**
             * This is STEP 4.1: Selecting only local script functions which were pre-built into the extension.
             *
             * The whole process is explained below.
             *
             * To fully comply with Chrome Web Store policies regarding remote code execution,
             * we implement a strict security-focused approach for Scriptlet and JavaScript rules execution.
             *
             * 1. Default - regular users that did not grant User scripts API permission explicitly:
             *    - We collect and pre-build script rules from the filters and statically bundle
             *      them into the extension - STEP 1. See 'updateLocalResourcesForMv3' in our build tools.
             *      IMPORTANT: all scripts and their arguments are local and bundled within the extension.
             *    - These pre-verified local scripts are passed to the engine - STEP 2.
             *    - At runtime before the execution, we check if each script rule is included
             *      in our local scripts list (STEP 3).
             *    - Only pre-verified local scripts are executed via chrome.scripting API (STEP 4.1 and 4.2).
             *      All other scripts are discarded.
             *    - Custom filters are NOT allowed for regular users to prevent any possibility
             *      of remote code execution, regardless of rule interpretation.
             *
             * 2. For advanced users that explicitly granted User scripts API permission -
             *    via enabling the Developer mode or Allow user scripts in the extension details:
             *    - Custom filters are allowed and may contain Scriptlet and JS rules
             *      that can be executed using the browser's built-in userScripts API (STEP 4.3),
             *      which provides a secure sandbox.
             *    - This execution bypasses the local script verification process but remains
             *      isolated and secure through Chrome's native sandboxing.
             *    - This mode requires explicit user activation and is intended for advanced users only.
             *
             * IMPORTANT:
             * Custom filters are ONLY supported when User scripts API permission is explicitly enabled.
             * This strict policy prevents Chrome Web Store rejection due to potential remote script execution.
             * When custom filters are allowed, they may contain:
             * 1. Network rules – converted to DNR rules and applied via dynamic rules.
             * 2. Cosmetic rules – interpreted directly in the extension code.
             * 3. Scriptlet and JS rules – executed via the browser's userScripts API (userScripts.execute)
             *    with Chrome's native sandboxing providing security isolation.
             *
             * For regular users without User scripts API permission (default case):
             * - Only pre-bundled filters with statically verified scripts are supported.
             * - Downloading custom filters or any rules from remote sources is blocked entirely
             *   to ensure compliance with the store policies.
             *
             * This implementation ensures perfect compliance with Chrome Web Store policies
             * by preventing any possibility of remote code execution for regular users.
             *
             * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
             */
            /**
             * Here we check if the script text is local to guarantee that we do not execute remote code.
             */
            const isLocalScript = localScriptRulesService.isLocalScript(scriptText);
            if (!isLocalScript) {
                return;
            }

            /**
             * Here we get the function associated with the script text.
             */
            const localScriptFunction = localScriptRulesService.getLocalScriptFunction(scriptText);
            if (!localScriptFunction) {
                return;
            }

            try {
                await ScriptingApi.executeScriptFunc({
                    tabId,
                    frameId,
                    scriptFunction: localScriptFunction,
                });
            } catch (e) {
                logger.info(`[tsweb.CosmeticApi.applyJsFuncs]: error occurred during injection into tabId ${tabId} and frameId ${frameId}: `, e);
            }
        });

        // allSettled is used to ensure that all scripts will injected
        // even if some of them fail.
        await Promise.allSettled(tasks);
    }

    /**
     * Injects js to specified tab and frame.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param scriptletDataList List of scriptlet data to inject.
     * @param frameContextUrl Frame context url.
     */
    private static async applyScriptlets(
        tabId: number,
        frameId: number,
        scriptletDataList: ScriptletData[],
        frameContextUrl: string,
    ): Promise<void> {
        if (scriptletDataList.length === 0) {
            return;
        }

        // allSettled is used to ensure that all scriptlets will injected
        // even if some of them fail.
        await Promise.allSettled(scriptletDataList.map(async (scriptletData) => {
            try {
                await ScriptingApi.executeScriptlet({
                    tabId,
                    frameId,
                    scriptletData,
                    domainName: getDomain(frameContextUrl),
                });
            } catch (e) {
                logger.info(`[tsweb.CosmeticApi.applyScriptlets]: error occurred during injection to tabId ${tabId} and frameId ${frameId}: ${e}`);
            }
        }));
    }

    /**
     * Checks if cosmetics should be applied —
     * background page or extension pages do not need cosmetics applied.
     *
     * @param tabId Tab id.
     * @param frameUrl Frame url.
     *
     * @returns True if cosmetics should be applied, false otherwise.
     */
    public static shouldApplyCosmetics(tabId: number, frameUrl: string): boolean {
        // no need to apply cosmetic rules on background or extension pages
        if (tabId === BACKGROUND_TAB_ID || isExtensionUrl(frameUrl)) {
            return false;
        }

        return true;
    }

    /**
     * Injects marked CSS with a bounded retry policy.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param cssText Marked CSS text.
     * @param documentId Document the CSS was prepared for, when known.
     * @param frameContext Frame context that was matched for {@link cssText}.
     * @param tries Number of tries already made.
     *
     * @returns Promise that resolves when the CSS is injected.
     */
    private static async injectMarkedCssWithRetries(
        tabId: number,
        frameId: number,
        cssText: string,
        documentId: string | undefined,
        frameContext: MarkedCssFrameContext | undefined,
        tries = 0,
    ): Promise<void> {
        try {
            await ScriptingApi.insertCSS({
                cssText,
                tabId,
                frameId,
                documentId,
            });
        } catch (e) {
            if (tries >= CosmeticApi.INJECTION_MAX_TRIES) {
                throw e;
            }

            await new Promise<void>((resolve) => {
                setTimeout(resolve, CosmeticApi.INJECTION_RETRY_TIMEOUT_MS);
            });

            const currentFrameContext = tabsApi.getFrameContext(tabId, frameId);

            if (!CosmeticApi.isSameDocumentAfterRetryDelay(
                currentFrameContext,
                documentId,
                frameContext,
            )) {
                // The frame navigated while waiting. Do not inject the old
                // document's CSS into the new document.
                throw e;
            }

            await CosmeticApi.injectMarkedCssWithRetries(
                tabId,
                frameId,
                cssText,
                documentId,
                frameContext,
                tries + 1,
            );
        }
    }

    /**
     * Checks whether a retry still targets the document of the first attempt.
     *
     * A navigation mutates the document id of the live frame context in place,
     * so the id is compared when either side knows it. Without any document
     * id, a replaced frame context is the only signal of a navigation.
     *
     * @param currentFrameContext Frame context read after the retry delay.
     * @param documentId Document id the first attempt was bound to.
     * @param frameContext Frame context the operation started with.
     *
     * @returns True when the retry may inject into the same document.
     */
    private static isSameDocumentAfterRetryDelay(
        currentFrameContext: MarkedCssFrameContext | undefined,
        documentId: string | undefined,
        frameContext: MarkedCssFrameContext | undefined,
    ): boolean {
        if (documentId !== undefined || currentFrameContext?.documentId !== undefined) {
            return currentFrameContext?.documentId === documentId;
        }

        return currentFrameContext === frameContext;
    }

    /**
     * Returns the frame context for reading and writing marked CSS records,
     * but only while it still describes the given document.
     *
     * The records are keyed by the frame context and store its document id, so
     * they can describe only that document. A navigation mutates the frame
     * context in place, so the check must run when the record is used rather
     * than when the operation starts.
     *
     * @param frameContext Frame context.
     * @param documentId Document id the operation targets.
     *
     * @returns The frame context, or undefined when it describes another
     * document.
     */
    private static getRecordsFrameContext<T extends MarkedCssFrameContext>(
        frameContext: T | undefined,
        documentId: string | undefined,
    ): T | undefined {
        return frameContext && frameContext.documentId === documentId
            ? frameContext
            : undefined;
    }

    /**
     * Injects prepared CSS.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param documentId Document the CSS was prepared for, when known.
     * @param frameContext Frame context that was matched for {@link cssText}.
     * @param preparedCosmeticResult Prepared cosmetic result.
     * @param cssText CSS text to inject.
     */
    private static async injectPreparedCss(
        tabId: number,
        frameId: number,
        documentId: string | undefined,
        frameContext: MarkedCssFrameContext,
        preparedCosmeticResult: PreparedCosmeticResultMV3,
        cssText: string,
    ): Promise<void> {
        try {
            await ScriptingApi.insertCSS({
                cssText,
                tabId,
                frameId,
                documentId,
            });

            const recordsFrameContext = CosmeticApi.getRecordsFrameContext(
                frameContext,
                documentId,
            );
            if (!recordsFrameContext) {
                return;
            }

            CosmeticApi.setNativeHitsMarkersApplied(
                recordsFrameContext,
                preparedCosmeticResult,
                preparedCosmeticResult.areHitsStatsCollected,
            );
            if (preparedCosmeticResult.areHitsStatsCollected) {
                CosmeticApi.setMarkedCssInjected(recordsFrameContext);
            }
        } catch (e) {
            const recordsFrameContext = CosmeticApi.getRecordsFrameContext(
                frameContext,
                documentId,
            );
            if (recordsFrameContext) {
                CosmeticApi.setNativeHitsMarkersApplied(
                    recordsFrameContext,
                    preparedCosmeticResult,
                    false,
                );
            }
            logger.info(`[tsweb.CosmeticApi.injectPreparedCss]: error occurred during injection into tabId ${tabId} and frameId ${frameId} `, e);
        }
    }

    /**
     * Injects css to specified tab id and frame id.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param cssText CSS text to inject.
     *
     * @returns A promise that resolves when the CSS is injected.
     */
    private static applyCss(
        tabId: number,
        frameId: number,
        cssText: string | undefined,
    ): Promise<void> {
        const frameContext = tabsApi.getFrameContext(tabId, frameId);
        const preparedCosmeticResult = frameContext?.preparedCosmeticResult;

        if (!frameContext || !preparedCosmeticResult) {
            return Promise.resolve();
        }

        // The CSS is prepared for this document, so a navigation during the
        // injection must not move it to the next one.
        const { documentId } = frameContext;

        return CosmeticApiCommon.applyCssWithCache({
            frameContext,
            preparedCosmeticResult,
            cssText,
            inject: () => CosmeticApi.injectPreparedCss(
                tabId,
                frameId,
                documentId,
                frameContext,
                preparedCosmeticResult,
                cssText as string,
            ),
        });
    }

    /**
     * Runs an ExtendedCss operation through the per-document queue.
     *
     * Every ExtendedCss operation replaces the instance the document holds, so
     * two operations for one document must not run concurrently: the older one
     * could finish last and leave its instance in the page. The queue tail is
     * `extCssInjectionInFlight`: an operation registers its entry before it
     * starts and settles it after its record writes, so the next operation for
     * the same document waits for it.
     *
     * An entry of another document is never awaited: a navigation has moved
     * the frame context on, and the captured document's operation is bound to
     * its own id. A live frame context that already describes another document
     * rejects the request before the tail is read, and after every wait the
     * captured document is checked again, so a stale waiter neither starts its
     * operation nor replaces the queue entry of the document the frame context
     * now holds.
     *
     * A frame context that is already gone (a pruned live subframe) has no
     * queue to read, so its operation runs without one.
     *
     * @param params Operation parameters.
     * @param params.frameContext Frame context that keys the queue, when known.
     * @param params.documentId Document the operation targets, captured before
     * any wait.
     * @param params.preparedCosmeticResult Prepared result the operation
     * applies, when it can be attributed to one.
     * @param params.skipIfSettledSameResult Whether to skip the operation when
     * the awaited one settled the same prepared result.
     * @param params.operation Operation to run after the queue settles. Its
     * record writes must be part of it, so the next operation reads them.
     *
     * @returns True when the operation ran, false when it was skipped because
     * the frame moved on to another document or the same prepared result was
     * already handled.
     */
    private static async runQueuedExtCssOperation(params: {
        frameContext: MarkedCssFrameContext | undefined;
        documentId: string | undefined;
        preparedCosmeticResult?: PreparedCosmeticResultMV3;
        skipIfSettledSameResult?: boolean;
        operation: () => Promise<void>;
    }): Promise<boolean> {
        const {
            frameContext,
            documentId,
            preparedCosmeticResult,
            skipIfSettledSameResult = false,
            operation,
        } = params;

        if (!frameContext) {
            // Without a frame context there is no queue key, so nothing can be
            // in flight for this document. This is a pruned live subframe, so
            // its operation still runs.
            await operation();
            return true;
        }

        if (frameContext.documentId !== documentId) {
            // The live frame context already describes another document, so
            // this request belongs to a document it left. Reject it before
            // reading or replacing the queue tail of the current document.
            return false;
        }

        let pending = CosmeticApi.extCssInjectionInFlight.get(frameContext);
        while (pending && pending.documentId === documentId) {
            const settled = pending;

            // eslint-disable-next-line no-await-in-loop -- operations are serialized on purpose
            await settled.promise;

            // A navigation mutates the live frame context in place, so the
            // rules of the captured document must not be applied to the next
            // one and must not replace the next document's queue entry.
            if (frameContext.documentId !== documentId) {
                return false;
            }

            if (skipIfSettledSameResult
                && preparedCosmeticResult !== undefined
                && settled.preparedCosmeticResult === preparedCosmeticResult) {
                // The settled operation applied this prepared result, or failed
                // and recorded the outcome, so a second injection would only
                // replace an identical instance.
                return false;
            }

            // Re-read the tail: another waiter may have registered after the
            // operation awaited above settled.
            pending = CosmeticApi.extCssInjectionInFlight.get(frameContext);
        }

        let settle!: () => void;
        const entry = {
            preparedCosmeticResult,
            documentId,
            promise: new Promise<void>((resolve) => {
                settle = resolve;
            }),
        };

        // Registered before the operation starts, so the next caller queues
        // behind it.
        CosmeticApi.extCssInjectionInFlight.set(frameContext, entry);

        try {
            await operation();
        } finally {
            settle();

            // A caller of another document can replace the entry while this
            // operation runs; only the current tail may be removed.
            if (CosmeticApi.extCssInjectionInFlight.get(frameContext) === entry) {
                CosmeticApi.extCssInjectionInFlight.delete(frameContext);
            }
        }

        return true;
    }

    /**
     * Injects ExtendedCss rules into the specified tab and frame directly from
     * the background via the Scripting API.
     *
     * The injection is bound to the frame context's document, so a navigation
     * between queueing and executing it cannot apply the rules to a different
     * document. When there are no matching rules (empty or null), nothing is
     * applied; an instance already injected into this document is disposed
     * instead, so a stale instance cannot stay active. The disposal is
     * unconditional, because only the document itself knows whether it holds
     * an instance.
     *
     * Errors are caught and logged, so restricted pages must not disrupt the
     * extension. When `areHitsStatsCollected` is true, the rules carry hits
     * markers and the injected func registers a `beforeStyleApplied` callback
     * that reports hits back to the background.
     *
     * The injection runs through the per-document ExtendedCss queue: it
     * registers its entry before it starts, so a marked re-apply for the same
     * document can wait for it even though the caller does not await this
     * injection. When the awaited operation carried the same prepared result,
     * its outcome is already recorded and no second injection is made.
     *
     * @param frameContext Frame context with the prepared ExtendedCss rules.
     *
     * @returns A promise that resolves when the rules are injected.
     */
    private static async applyExtCssRules(frameContext: FrameMV3): Promise<void> {
        const { preparedCosmeticResult } = frameContext;

        if (!preparedCosmeticResult) {
            return;
        }

        const { extCssRules, areHitsStatsCollected } = preparedCosmeticResult;
        // The rules are prepared for this document, so a navigation during the
        // injection must not move them to the next one.
        const { tabId, frameId, documentId } = frameContext;

        await CosmeticApi.runQueuedExtCssOperation({
            frameContext,
            documentId,
            preparedCosmeticResult,
            // An operation that already applied these rules recorded its
            // outcome, so a second injection would replace an identical
            // instance.
            skipIfSettledSameResult: true,
            operation: async () => {
                const applied = await CosmeticApi.injectExtCssRules(
                    { tabId, frameId, documentId },
                    extCssRules,
                    areHitsStatsCollected,
                );

                // The record describes the injected document, so it is written
                // only while the frame context still holds it.
                const recordsFrameContext = CosmeticApi.getRecordsFrameContext(
                    frameContext,
                    documentId,
                );
                if (recordsFrameContext) {
                    CosmeticApi.setExtCssMarkersApplied(
                        recordsFrameContext,
                        preparedCosmeticResult,
                        applied,
                    );
                }
            },
        });
    }

    /**
     * Injects ExtendedCss rules into a frame's document, or disposes the
     * instance already there when the rule set is empty.
     *
     * The injection is bound to the document when its id is known, so a
     * navigation between queueing and executing it cannot apply the rules to a
     * different document. The disposal is unconditional: the instance lives in
     * the document's isolated world, while the background cannot tell whether
     * that document still holds one — a BFCache restore or a prerender
     * activation recreates the frame context. The injected function is a no-op
     * without an instance.
     *
     * Errors are caught and logged, so restricted pages must not disrupt the
     * extension.
     *
     * @param target Tab, frame and, when known, document to inject into.
     * @param target.tabId The ID of the tab.
     * @param target.frameId The ID of the frame.
     * @param target.documentId The ID of the document, when known.
     * @param extCssRules ExtendedCss rule strings to apply.
     * @param collectStats Whether the rules carry hits markers and the injected
     * func must report hits back to the background.
     *
     * @returns True when the injection ran or nothing was expected, false when
     * it threw.
     */
    private static async injectExtCssRules(
        { tabId, frameId, documentId }: ExecuteExtCssTarget,
        extCssRules: string[] | null,
        collectStats: boolean,
    ): Promise<boolean> {
        try {
            if (!extCssRules || extCssRules.length === 0) {
                await ScriptingApi.disposeExtCss({ tabId, frameId, documentId });

                return true;
            }

            await ScriptingApi.executeExtCss({
                tabId,
                frameId,
                documentId,
                cssRules: extCssRules,
                collectStats,
            });

            return true;
        } catch (e) {
            logger.info(`[tsweb.CosmeticApi.injectExtCssRules]: error occurred during injection into tabId ${tabId} and frameId ${frameId} `, e);

            return false;
        }
    }

    /**
     * Filters script rules for logging.
     *
     * @param params Data for JS rule logging.
     *
     * @returns Script rules which expected to be applied and logged.
     */
    private static filterScriptRulesForLog(params: LogJsRulesParamsMv3): CosmeticRule[] {
        const { preparedCosmeticResult: { localRules, remoteRules } } = params;

        // If User scripts API is enabled, we apply all script rules
        if (UserScriptsApi.isEnabled) {
            return localRules.rawRules.concat(remoteRules.rawRules);
        }

        // Otherwise, we apply only local script rules which were pre-built into
        // the extension.
        return localRules.rawRules.filter((rule): boolean => {
            const ruleFromBuiltInFilter = engineApi.isLocalFilter(rule.getFilterListId());
            const ruleFromUserRules = engineApi.isUserRulesFilter(rule.getFilterListId());

            // Double-check that the rule was correctly marked as local.
            if (!ruleFromBuiltInFilter && !ruleFromUserRules) {
                return false;
            }

            // All rules from built-in filter are allowed.
            if (ruleFromBuiltInFilter) {
                return true;
            }

            // But local rules from user rules filter are allowed only
            // if they are exists in built in filters.
            const scriptText = rule.getScript();
            if (!scriptText) {
                return false;
            }

            const isLocalScript = localScriptRulesService.isLocalScript(scriptText);
            if (!isLocalScript) {
                return false;
            }

            return true;
        });
    }

    /**
     * Logs JS rules applied to specific frame.
     *
     * We need a separate function for logging because script rules can be logged
     * before injection to avoid duplicate logs while the JS rule is being applied.
     *
     * See {@link WebRequestApi.onBeforeRequest} for details.
     *
     * TODO: Since injection and logging are happened in different places,
     * we do not track was injection successful or not - we log all rules which
     * expected to be applied. We should track injection result.
     *
     * @param params Data for JS rule logging.
     */
    public static logScriptRules(params: LogJsRulesParamsMv3): void {
        const scriptRules = CosmeticApi.filterScriptRulesForLog(params);

        super.logScriptRules(params, scriptRules, engineApi);
    }

    /**
     * Applies cosmetic rules to the specified tab and frame.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param shouldApplyCss We are not applying CSS on onResponseStarted, since
     * it might be too early. Instead, we wait until the DOM is ready on
     * onCommitted and apply them then.
     *
     * @returns A promise that resolves when the cosmetic rules are applied. The
     * ExtendedCss injection is deliberately left floating, so it may still be
     * in flight when the promise resolves.
     */
    public static async applyCosmeticRules(
        tabId: number,
        frameId: number,
        shouldApplyCss: boolean,
    ): Promise<PromiseSettledResult<void>[]> {
        const frameContext = tabsApi.getFrameContext(tabId, frameId);

        if (!frameContext || !frameContext.preparedCosmeticResult) {
            logger.debug(`[tsweb.CosmeticApi.applyCosmeticRules]: no prepared cosmetic result for tabId ${tabId} and frameId ${frameId}`);
            return [];
        }

        const tasks = [
            CosmeticApi.applyLocalCosmeticRules(
                tabId,
                frameId,
                frameContext.preparedCosmeticResult.localRules,
                frameContext.url,
            ),
            CosmeticApi.applyRemoteCosmeticRules(
                tabId,
                frameId,
                frameContext.preparedCosmeticResult.remoteRules,
            ),
        ];

        if (shouldApplyCss) {
            tasks.push(
                CosmeticApi.applyCss(tabId, frameId, frameContext.preparedCosmeticResult.cssText),
            );

            // Deliberately not awaited: the ExtendedCss payload is ~50 KB and has
            // to be compiled and executed in every matched frame, while
            // `processOpenTabs` awaits this method before `isAppStarted` is
            // set, so awaiting it delays startup for every open tab. The
            // injection still starts immediately (`injectImmediately: true`).
            // `applyExtCssRules` catches and logs its own errors, so this
            // catch only guards against an unhandled rejection.
            CosmeticApi.applyExtCssRules(frameContext).catch((e: unknown) => {
                logger.error(`[tsweb.CosmeticApi.applyCosmeticRules]: unhandled ExtendedCss injection rejection for tabId ${tabId} and frameId ${frameId} `, e);
            });
        }

        return Promise.allSettled(tasks);
    }

    /**
     * Applies local cosmetic rules to the specified tab and frame via using
     * Scripting API.
     * It is safe since local rules are pre-built into the extension
     * and do not contain any remote code.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param localRules Local rules to apply.
     * @param frameContextUrl Frame context url.
     *
     * @returns A promise that resolves when the local rules are applied.
     */
    private static async applyLocalCosmeticRules(
        tabId: number,
        frameId: number,
        localRules: PreparedCosmeticResultMV3['localRules'],
        frameContextUrl: string,
    ): Promise<void> {
        const { scriptTexts, scriptletDataList } = localRules;

        await CosmeticApi.applyJsFuncs(tabId, frameId, scriptTexts);
        await CosmeticApi.applyScriptlets(tabId, frameId, scriptletDataList, frameContextUrl);
    }

    /**
     * Injects JS functions and scriptlets to specified tab and frame via using
     * UserScripts API.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param remoteRules JS rules from remote filters, e.g. custom filters or
     * user rules.
     *
     * @returns A promise that resolves when the remote rules are applied.
     */
    private static async applyRemoteCosmeticRules(
        tabId: number,
        frameId: number,
        remoteRules: PreparedCosmeticResultMV3['remoteRules'],
    ): Promise<void> {
        // If User scripts API is not enabled, we can not apply remote cosmetic
        // rules due to Chrome Web Store policies.
        if (!UserScriptsApi.isEnabled) {
            return;
        }

        const { scriptText } = remoteRules;

        if (!scriptText) {
            return;
        }

        try {
            await UserScriptsApi.executeScripts({
                tabId,
                frameId,
                scriptText,
            });
        } catch (e) {
            logger.info('[tsweb.CosmeticApi.applyRemoteCosmeticRules]: error occurred during injection: ', e);
        }
    }
}

const cosmeticApi = new CosmeticApi();

export { cosmeticApi };
