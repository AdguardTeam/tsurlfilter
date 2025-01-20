import { type CosmeticResult } from '@adguard/tsurlfilter';
import { CosmeticRuleType } from '@adguard/agtree';

import { CosmeticApiCommon, type ContentScriptCosmeticData, type LogJsRulesParams } from '../../common/cosmetic-api';
import { getErrorMessage } from '../../common/error';
import { defaultFilteringLog, FilteringEventType } from '../../common/filtering-log';
import { createFrameMatchQuery } from '../../common/utils/create-frame-match-query';
import { logger } from '../../common/utils/logger';
import { nanoid } from '../../common/utils/nanoid';
import { getDomain } from '../../common/utils/url';
import { type ScriptletRuleData } from '../tabs/frame';
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
    scriptletDataList: ScriptletRuleData[],
};

/**
 * Cosmetic api class.
 * Used to prepare and inject javascript and css into pages.
 */
export class CosmeticApi extends CosmeticApiCommon {
    /**
     * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
     *
     * This is STEP 3: All previously matched script rules are processed and filtered:
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
                const scriptletRunData = rule.getScriptletData();

                // it looks like `//scriptlet...` so it will be easily matched against localScriptletRules
                const scriptletRuleText = rule.getContent();

                if (scriptletRunData && scriptletRuleText) {
                    scriptletDataList.push({
                        scriptletRunData,
                        scriptletRuleText,
                    });
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
                 * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
                 *
                 * This is STEP 4.1: Selecting only local script functions which were pre-built into the extension.
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
                /**
                 * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
                 *
                 * This is STEP 4.2: Selecting only local scriptlet rules which were pre-built into the extension.
                 */

                const { scriptletRunData, scriptletRuleText } = scriptletData;

                /**
                 * Here we check if the scriptlet rule is local to guarantee that we do not execute remote code.
                 */
                const isLocalScriptlet = localScriptRulesService.isLocalScriptlet(scriptletRuleText);
                if (!isLocalScriptlet) {
                    return;
                }

                // eslint-disable-next-line consistent-return
                return ScriptingApi.executeScriptlet({
                    tabId,
                    frameId,
                    scriptletRunData,
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
        const {
            tabId,
            cosmeticResult,
            url,
            contentType,
            timestamp,
        } = params;

        const scriptRules = cosmeticResult.getScriptRules();

        for (const scriptRule of scriptRules) {
            if (scriptRule.isGeneric()) {
                continue;
            }

            const ruleText = scriptRule.getContent();

            // do not log rules if they are not local
            // which means that will not be applied
            if (
                !localScriptRulesService.isLocalScript(ruleText)
                && !localScriptRulesService.isLocalScriptlet(ruleText)
            ) {
                continue;
            }

            const ruleType = scriptRule.getType();
            defaultFilteringLog.publishEvent({
                type: FilteringEventType.JsInject,
                data: {
                    script: true,
                    tabId,
                    // for proper filtering log request info rule displaying
                    // event id should be unique for each event, not copied from request
                    // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2341
                    eventId: nanoid(),
                    requestUrl: url,
                    frameUrl: url,
                    frameDomain: getDomain(url) as string,
                    requestType: contentType,
                    timestamp,
                    filterId: scriptRule.getFilterListId(),
                    ruleIndex: scriptRule.getIndex(),
                    cssRule: ruleType === CosmeticRuleType.ElementHidingRule
                        || ruleType === CosmeticRuleType.CssInjectionRule,
                    scriptRule: ruleType === CosmeticRuleType.ScriptletInjectionRule
                        || ruleType === CosmeticRuleType.JsInjectionRule,
                    contentRule: ruleType === CosmeticRuleType.HtmlFilteringRule,
                },
            });
        }
    }
}
