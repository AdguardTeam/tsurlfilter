import { type CosmeticRule, type ScriptletData } from '@adguard/tsurlfilter';

import { BACKGROUND_TAB_ID } from '../../common/constants';
import { type ContentScriptCosmeticData, CosmeticApiCommon, type LogJsRulesParams } from '../../common/cosmetic-api';
import { createFrameMatchQuery } from '../../common/utils/create-frame-match-query';
import { logger } from '../../common/utils/logger';
import { getDomain, getHost, isExtensionUrl } from '../../common/utils/url';
import { type PreparedCosmeticResultMV3 } from '../tabs/frame';
import { tabsApi } from '../tabs/tabs-api';

import { appContext } from './app-context';
import { engineApi } from './engine-api';
import { computeRuleHash } from './preregistered-scripts/hasher';
import { ScriptingApi } from './scripting-api';
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
 * Parameters of {@link CosmeticApi.applyCosmeticRules}.
 */
interface ApplyCosmeticRulesParams {
    /**
     * Tab id.
     */
    tabId: number;

    /**
     * Frame id.
     */
    frameId: number;

    /**
     * Whether to apply CSS. We do not apply CSS on onResponseStarted, since
     * it might be too early. Instead, we wait until the DOM is ready on
     * onCommitted and apply it then.
     */
    shouldApplyCss: boolean;

    /**
     * When `true`, skips the preregistered-domain check and always injects
     * dynamically. Used for pages that could not have received the
     * preregistered bundle (no persisted registration existed when the page
     * loaded). Defaults to `false`.
     */
    forceDynamicInjection?: boolean;
}

/**
 * Cosmetic api class.
 * Used to prepare and inject javascript and css into pages.
 */
export class CosmeticApi extends CosmeticApiCommon {
    /**
     * Domains for which scriptlets and JS rules are injected via
     * preregistered content scripts (`chrome.scripting.registerContentScripts`).
     *
     * Stored as exact hostnames mapped to the hashes of the covered
     * rules — the same hostname semantics as the registered content-script
     * match patterns: a preregistered `www.` alias does NOT cover the apex
     * domain and vice versa.
     *
     * For a matching hostname, dynamic injection is skipped only for the
     * listed rule hashes to avoid double execution — the preregistered
     * bundle already handles them. Rules degraded at sync time (runtime
     * `$path` exceptions, missing per-hash files) are absent and keep the
     * dynamic injection path.
     *
     * Set via {@link setPreregisteredScriptRules}.
     */
    private static preregisteredScriptRules: ReadonlyMap<string, ReadonlySet<string>> = new Map();

    /**
     * Sets the rules covered by preregistered content scripts, per hostname.
     *
     * Covered rules are not injected dynamically by the cosmetic API,
     * preventing double execution with the preregistered bundles.
     *
     * @param rules Hostname to covered rule hashes map.
     */
    public static setPreregisteredScriptRules(rules: ReadonlyMap<string, ReadonlySet<string>>): void {
        CosmeticApi.preregisteredScriptRules = rules;
    }

    /**
     * Returns the hashes of preregistered rules for a URL's exact hostname.
     *
     * @param url URL to check.
     *
     * @returns Covered rule hashes or `undefined` for non-preregistered hosts.
     */
    private static getPreregisteredCoveredRules(url: string): ReadonlySet<string> | undefined {
        const host = getHost(url);
        return host ? CosmeticApi.preregisteredScriptRules.get(host) : undefined;
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
            extCssRules: null,
            nativeCssSelectors: null,
        };

        // if storage is not initialized, then app is not ready yet.
        if (!appContext.isStorageInitialized) {
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

        // Do not collect hits stats if website is allowlisted
        const isDocumentAllowlisted = !!tabContext.mainFrameRule
            && tabContext.mainFrameRule.isFilteringDisabled();

        data.areHitsStatsCollected = data.areHitsStatsCollected && !isDocumentAllowlisted;

        const matchQuery = createFrameMatchQuery(frameUrl, frameId, tabContext);

        const cosmeticResult = engineApi.matchCosmetic(matchQuery);

        data.extCssRules = CosmeticApi.getExtCssRules(
            cosmeticResult,
            {
                areHitsStatsCollected,
                // always true for MV3
                // since minimum version of mv3 browser already supports :has()
                isNativeHasSupported: true,
            },
        );

        data.nativeCssSelectors = CosmeticApi.getNativeCssSelectors(
            cosmeticResult,
            { isNativeHasSupported: true },
        );

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
     * Injects css to specified tab id and frame id.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @param cssText CSS text to inject.
     *
     * @returns A promise that resolves when the CSS is injected.
     */
    private static async applyCss(
        tabId: number,
        frameId: number,
        cssText: string | undefined,
    ): Promise<void> {
        if (!cssText) {
            return;
        }

        try {
            await ScriptingApi.insertCSS({
                cssText,
                tabId,
                frameId,
            });
        } catch (e) {
            logger.info(`[tsweb.CosmeticApi.applyCss]: error occurred during injection into tabId ${tabId} and frameId ${frameId} `, e);
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
     * @param params Parameters of the call, see {@link ApplyCosmeticRulesParams}.
     *
     * @returns A promise that resolves when the cosmetic rules are applied.
     */
    public static async applyCosmeticRules(
        params: ApplyCosmeticRulesParams,
    ): Promise<PromiseSettledResult<void>[]> {
        const {
            tabId,
            frameId,
            shouldApplyCss,
            forceDynamicInjection = false,
        } = params;

        const frameContext = tabsApi.getFrameContext(tabId, frameId);

        if (!frameContext || !frameContext.preparedCosmeticResult) {
            logger.debug(`[tsweb.CosmeticApi.applyCosmeticRules]: no prepared cosmetic result for tabId ${tabId} and frameId ${frameId}`);
            return [];
        }

        const tasks: Promise<void>[] = [];

        // Skip dynamic injection of the rules covered by preregistered
        // content scripts — injecting them again would cause double
        // execution. Rules missing from the covered set (degraded at sync
        // time) still go through the dynamic path. `remoteRules` below
        // doesn't need this guard: it only ever contains custom/user filter
        // rules, which preregistered scripts (local filters only) never cover.
        const coveredRules = forceDynamicInjection
            ? undefined
            : CosmeticApi.getPreregisteredCoveredRules(frameContext.url);

        const { localRules } = frameContext.preparedCosmeticResult;

        if (!coveredRules) {
            tasks.push(
                CosmeticApi.applyLocalCosmeticRules(
                    tabId,
                    frameId,
                    localRules,
                    frameContext.url,
                ),
            );
        } else {
            // Rules are identified by hash: engine-sourced rules don't
            // carry their text, so a text-based identity would never match.
            // Rules that fail to hash keep the dynamic injection path —
            // coverage can't be proven for them.
            const uncoveredRules = (
                await Promise.all(localRules.rawRules.map(async (rule) => {
                    try {
                        return coveredRules.has(await computeRuleHash(rule)) ? null : rule;
                    } catch (e) {
                        // eslint-disable-next-line max-len
                        logger.error(`[tsweb.CosmeticApi.applyCosmeticRules]: Failed to hash a rule for "${frameContext.url}", keeping dynamic injection`, e);
                        return rule;
                    }
                }))
            ).filter((rule): rule is CosmeticRule => rule !== null);

            if (uncoveredRules.length > 0) {
                const rulesToApply = uncoveredRules.length === localRules.rawRules.length
                    ? localRules
                    : {
                        ...CosmeticApi.getScriptsAndScriptletsData(uncoveredRules),
                        rawRules: uncoveredRules,
                    };

                tasks.push(
                    CosmeticApi.applyLocalCosmeticRules(
                        tabId,
                        frameId,
                        rulesToApply,
                        frameContext.url,
                    ),
                );
            }
        }

        tasks.push(
            CosmeticApi.applyRemoteCosmeticRules(
                tabId,
                frameId,
                frameContext.preparedCosmeticResult.remoteRules,
            ),
        );

        if (shouldApplyCss) {
            tasks.push(
                CosmeticApi.applyCss(tabId, frameId, frameContext.preparedCosmeticResult.cssText),
            );
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
