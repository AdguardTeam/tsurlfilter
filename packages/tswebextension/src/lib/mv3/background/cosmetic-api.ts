import { type ScriptletData, type CosmeticResult, type CosmeticRule } from '@adguard/tsurlfilter';

import { CosmeticApiCommon, type ContentScriptCosmeticData, type LogJsRulesParams } from '../../common/cosmetic-api';
import { createFrameMatchQuery } from '../../common/utils/create-frame-match-query';
import { logger } from '../../common/utils/logger';
import { getDomain, isExtensionUrl } from '../../common/utils/url';
import { tabsApi } from '../tabs/tabs-api';
import { BACKGROUND_TAB_ID, USER_FILTER_ID } from '../../common/constants';

import { appContext } from './app-context';
import { engineApi } from './engine-api';
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

/**
 * Cosmetic api class.
 * Used to prepare and inject javascript and css into pages.
 */
export class CosmeticApi extends CosmeticApiCommon {
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
     *      them into the extension - STEP 1. See 'updateLocalResourcesForChromiumMv3' in our build tools.
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
     * @param cosmeticResult Object containing cosmetic rules.
     *
     * @returns An object with data for scriptlets and script texts.
     */
    public static getScriptsAndScriptletsData(cosmeticResult: CosmeticResult): ScriptsAndScriptletsDataMv3 {
        const rules = cosmeticResult.getScriptRules();

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

        data.extCssRules = CosmeticApi.getExtCssRules(cosmeticResult, areHitsStatsCollected);

        return data;
    }

    /**
     * Injects js to specified tab and frame.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     */
    public static async applyJsFuncsByTabAndFrame(tabId: number, frameId: number): Promise<void> {
        const frameContext = tabsApi.getFrameContext(tabId, frameId);

        const scriptTexts = frameContext?.preparedCosmeticResult?.scriptTexts;

        if (!scriptTexts || scriptTexts.length === 0) {
            return;
        }

        try {
            await Promise.all(scriptTexts.map((scriptText) => {
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
                 *      them into the extension - STEP 1. See 'updateLocalResourcesForChromiumMv3' in our build tools.
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

                // eslint-disable-next-line consistent-return
                return ScriptingApi.executeScriptFunc({
                    tabId,
                    frameId,
                    scriptFunction: localScriptFunction,
                });
            }));
        } catch (e) {
            logger.info('[tsweb.CosmeticApi.applyJsFuncsByTabAndFrame]: error occurred during injection: ', e);
        }
    }

    /**
     * Injects js to specified tab and frame.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     */
    public static async applyScriptletsByTabAndFrame(tabId: number, frameId: number): Promise<void> {
        const frameContext = tabsApi.getFrameContext(tabId, frameId);

        if (!frameContext) {
            return;
        }

        const scriptletDataList = frameContext.preparedCosmeticResult?.scriptletDataList;

        if (!scriptletDataList) {
            return;
        }

        try {
            await Promise.all(scriptletDataList.map((scriptletData) => {
                // eslint-disable-next-line consistent-return
                return ScriptingApi.executeScriptlet({
                    tabId,
                    frameId,
                    scriptletData,
                    domainName: getDomain(frameContext.url),
                });
            }));
        } catch (e) {
            logger.info('[tsweb.CosmeticApi.applyScriptletsByTabAndFrame]: error occurred during injection: ', e);
        }
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
     */
    public static async applyCssByTabAndFrame(tabId: number, frameId: number): Promise<void> {
        const frameContext = tabsApi.getFrameContext(tabId, frameId);

        const cssText = frameContext?.preparedCosmeticResult?.cssText;
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
            logger.info('[tsweb.CosmeticApi.applyCssByTabAndFrame]: error occurred during injection: ', e, 'with frame context:', frameContext);
        }
    }

    /**
     * Injects js functions and scriptlets to specified tab and frame.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     */
    public static async applyJsFuncsAndScriptletsByTabAndFrame(
        tabId: number,
        frameId: number,
    ): Promise<void> {
        const frameContext = tabsApi.getFrameContext(tabId, frameId);

        if (!frameContext || !frameContext.preparedCosmeticResult) {
            return;
        }

        const { scriptText } = frameContext.preparedCosmeticResult;

        if (!scriptText) {
            return;
        }

        try {
            await ScriptingApi.executeScriptsViaUserScripts({
                tabId,
                frameId,
                scriptText,
            });
        } catch (e) {
            logger.info('[tsweb.CosmeticApi.applyJsFuncsAndScriptletsByTabAndFrame]: error occurred during injection: ', e);
        }
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
        return localScriptRulesService.isLocalScript(rule.getContent());
    }

    /**
     * Logs js rules applied to specific frame.
     *
     * We need a separate function for logging because script rules can be logged before injection
     * to avoid duplicate logs while the js rule is being applied.
     *
     * See {@link WebRequestApi.onBeforeRequest} for details.
     *
     * @param params Data for js rule logging.
     */
    public static logScriptRules(params: LogJsRulesParams): void {
        const filterFn = UserScriptsApi.isSupported
            // via userScripts API we can inject any script
            ? (): boolean => true
            : CosmeticApi.shouldSanitizeScriptRule;

        super.logScriptRules(
            params,
            filterFn,
        );
    }
}
