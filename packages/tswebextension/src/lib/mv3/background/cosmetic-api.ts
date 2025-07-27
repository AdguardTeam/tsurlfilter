import { type ScriptletData, type CosmeticResult, type CosmeticRule } from '@adguard/tsurlfilter';

import { CosmeticApiCommon, type ContentScriptCosmeticData, type LogJsRulesParams } from '../../common/cosmetic-api';
import { getErrorMessage } from '../../common/error';
import { createFrameMatchQuery } from '../../common/utils/create-frame-match-query';
import { logger } from '../../common/utils/logger';
import { getDomain } from '../../common/utils/url';
import { tabsApi } from '../tabs/tabs-api';

import { appContext } from './app-context';
import { engineApi } from './engine-api';
import { ScriptingApi } from './scripting-api';
import { localScriptRulesService } from './services/local-script-rules-service';

/**
 * Data for JS and scriptlets rules for MV3.
 */
type ScriptsAndScriptletsDataMv3 = {
    /**
     * Script texts from JS rules.
     */
    scriptTexts: string[],

    /**
     * List of scriptlet data objects.
     */
    scriptletDataList: ScriptletData[],
};

/**
 * Cosmetic api class.
 * Used to prepare and inject javascript and css into pages.
 */
export class CosmeticApi extends CosmeticApiCommon {
    /**
     * Search for 'JS_RULES_EXECUTION' to find all parts of script execution
     * process in the extension.
     *
     * 1. We collect and bundle all scripts that can be executed on web pages into
     *    the extension package into so-called `localScriptRules`.
     * 2. Rules that control when and where these scripts can be executed are also
     *    bundled within the extension package inside ruleset files.
     * 3. The rules look like: `example.org#%#scripttext`. Whenever the rule is
     *    matched, we check if there's a function for `scripttext` in
     *    `localScriptRules`, retrieve it from there and execute it.
     *
     * Here we're processing all previously matched script rules:
     * - JS and Scriptlet rules from pre-built filters (previously collected, pre-built and passed to the engine)
     *   are going to be executed as functions via chrome.scripting API.
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
                    scriptletDataList.push(
                        scriptletData,
                    );
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
            extCssRules: null,
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

        if (!frameContext) {
            return;
        }

        const scriptTexts = frameContext.preparedCosmeticResult?.scriptTexts;

        if (!scriptTexts || scriptTexts.length === 0) {
            return;
        }

        try {
            await Promise.all(scriptTexts.map((scriptText) => {
                /**
                 * Search for 'JS_RULES_EXECUTION' to find all parts of script execution
                 * process in the extension.
                 *
                 * 1. We collect and bundle all scripts that can be executed on web pages into
                 *    the extension package into so-called `localScriptRules`.
                 * 2. Rules that control when and where these scripts can be executed are also
                 *    bundled within the extension package inside ruleset files.
                 * 3. The rules look like: `example.org#%#scripttext`. Whenever the rule is
                 *    matched, we check if there's a function for `scripttext` in
                 *    `localScriptRules`, retrieve it from there and execute it.
                 *
                 * Here we're selecting only local script functions which were pre-built into the extension
                 * to guarantee that we do not execute remote code.
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
            logger.debug('[applyJsFuncsByTabAndFrame] error occurred during injection', getErrorMessage(e));
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
            // TODO: getErrorMessage may not be needed since logger should handle arg types
            logger.debug('[applyScriptletsByTabAndFrame] error occurred during injection', getErrorMessage(e));
        }
    }

    /**
     * Injects css to specified tab id and frame id.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     */
    public static async applyCssByTabAndFrame(tabId: number, frameId: number): Promise<void> {
        const requestContext = tabsApi.getFrameContext(tabId, frameId);

        const cssText = requestContext?.preparedCosmeticResult?.cssText;
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
            logger.debug(
                '[applyCssByTabAndFrame] error occurred during injection',
                getErrorMessage(e),
                'with request context:',
                requestContext,
            );
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
        const ruleText = rule.getContent();
        return localScriptRulesService.isLocalScript(ruleText);
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
        super.logScriptRules(
            params,
            CosmeticApi.shouldSanitizeScriptRule,
        );
    }
}
