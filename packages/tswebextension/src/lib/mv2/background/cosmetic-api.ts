import { type CosmeticResult, type CosmeticRule } from '@adguard/tsurlfilter';

import { USER_FILTER_ID } from '../../common/constants';
import { CosmeticApiCommon, type ContentScriptCosmeticData, type LogJsRulesParams } from '../../common/cosmetic-api';
import { createFrameMatchQuery } from '../../common/utils/create-frame-match-query';
import { logger } from '../../common/utils/logger';

import { appContext } from './app-context';
import { engineApi, tabsApi } from './api';
import { buildScriptText } from './injection-helper';
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
            buildScriptText(scriptText, appContext.startTimeMs),
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

        let cosmeticResult;

        const frameContext = tabsApi.getFrameContext(tabId, frameId);
        if (!frameContext || !frameContext.cosmeticResult) {
            const matchQuery = createFrameMatchQuery(frameUrl, frameId, tabContext);

            cosmeticResult = engineApi.matchCosmetic(matchQuery);

            tabsApi.updateFrameContext(tabId, frameId, { cosmeticResult });
        } else {
            cosmeticResult = frameContext.cosmeticResult;
        }

        data.extCssRules = CosmeticApi.getExtCssRules(cosmeticResult, areHitsStatsCollected);

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
     * @param params Data for js rule logging.
     */
    public static logScriptRules(params: LogJsRulesParams): void {
        super.logScriptRules(
            params,
            CosmeticApi.shouldSanitizeScriptRule,
        );
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

        try {
            await CosmeticApi.injectCss(tabId, frameId, cssText);
        } catch (e) {
            // Retry injection if it fails
            if (tries < CosmeticApi.INJECTION_MAX_TRIES) {
                setTimeout(() => {
                    CosmeticApi.applyCss(tabId, frameId, tries + 1);
                }, CosmeticApi.INJECTION_RETRY_TIMEOUT_MS);
            } else {
                logger.debug('[tsweb.CosmeticApi.applyCss]: error occurred during injection', e);
            }
        }
    }
}
