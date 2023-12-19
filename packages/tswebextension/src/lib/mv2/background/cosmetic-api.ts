/* eslint-disable jsdoc/require-returns */
import { nanoid } from 'nanoid';
import { CosmeticResult, CosmeticRule } from '@adguard/tsurlfilter';

import { appContext } from './context';
import { getDomain } from '../../common/utils/url';
import { USER_FILTER_ID } from '../../common/constants';
import { defaultFilteringLog, FilteringEventType } from '../../common/filtering-log';
import { buildScriptText } from './injection-helper';
import { localScriptRulesService } from './services/local-script-rules-service';
import { stealthApi } from './stealth-api';
import { TabsApi } from './tabs/tabs-api';
import { engineApi, tabsApi } from './api';
import { createFrameMatchQuery } from './utils/create-frame-match-query';
import { getErrorMessage } from '../../common/error';
import { logger } from '../../common/utils/logger';
import { CosmeticApiCommon } from '../../common/cosmetic-api';

import type { ContentType } from '../../common/request-type';

export type ApplyCosmeticRulesParams = {
    tabId: number,
    frameId: number,
    url?: string,
    cosmeticResult: CosmeticResult,
};

export type LogJsRulesParams = {
    tabId: number,
    cosmeticResult: CosmeticResult,
    url: string,
    contentType: ContentType,
    timestamp: number,
};

export type ContentScriptCosmeticData = {
    /**
     * Is app started.
     */
    isAppStarted: boolean,

    /**
     * Are hits stats collected.
     */
    areHitsStatsCollected: boolean,

    /**
     * Extended css rules to apply.
     */
    extCssRules: string[] | null,
};

/**
 * Cosmetic api class.
 * Used to prepare and inject javascript and css into pages.
 */
export class CosmeticApi extends CosmeticApiCommon {
    private static readonly ELEMHIDE_HIT_START = " { display: none !important; content: 'adguard";

    private static readonly INJECT_HIT_START = " content: 'adguard";

    private static readonly HIT_SEP = encodeURIComponent(';');

    private static readonly HIT_END = "' !important; }";

    // Timeout for cosmetic injection retry on failure.
    private static readonly INJECTION_RETRY_TIMEOUT_MS = 10;

    // Max number of tries to inject cosmetic rules.
    private static readonly INJECTION_MAX_TRIES = 100;

    /**
     * Applies scripts from a cosmetic result. It is possible inject a script
     * only once, because after the first inject, we set a flag in an isolated
     * copy of the window and all next calls to `buildScriptText` will return
     * nothing.
     *
     * @param scriptText Script text.
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @see {@link buildScriptText} for details about multiple injects.
     * @see {@link LocalScriptRulesService} for details about script source.
     */
    public static async injectScript(scriptText: string, tabId: number, frameId = 0): Promise<void> {
        return TabsApi.injectScript(buildScriptText(scriptText), tabId, frameId);
    }

    /**
     * Applies css from cosmetic result.
     *
     * Patches rule selector adding adguard mark rule info in the content attribute.
     * Example:
     * .selector -> .selector { content: 'adguard{filterId};{ruleText} !important;}.
     *
     * @param cssText Css text.
     * @param tabId Tab id.
     * @param frameId Frame id.
     */
    public static async injectCss(cssText: string, tabId: number, frameId = 0): Promise<void> {
        return TabsApi.injectCss(cssText, tabId, frameId);
    }

    /**
     * Retrieves css styles from the cosmetic result.
     *
     * @param cosmeticResult Cosmetic result.
     * @param collectingCosmeticRulesHits Flag to collect cosmetic rules hits.
     * @returns Css styles as string, or `undefined` if no styles found.
     */
    public static getCssText(cosmeticResult: CosmeticResult, collectingCosmeticRulesHits = false): string | undefined {
        const { elementHiding, CSS } = cosmeticResult;

        const elemhideCss = elementHiding.generic.concat(elementHiding.specific);
        const injectCss = CSS.generic.concat(CSS.specific);

        let styles: string[];

        if (collectingCosmeticRulesHits) {
            styles = CosmeticApi.buildStyleSheetsWithHits(elemhideCss, injectCss);
        } else {
            styles = CosmeticApi.buildStyleSheets(elemhideCss, injectCss, true);
        }

        if (styles.length > 0) {
            return styles.join(CosmeticApi.LINE_BREAK);
        }

        return undefined;
    }

    /**
     * Builds extended css rules from cosmetic result.
     *
     * @param cosmeticResult Cosmetic result.
     * @param collectingCosmeticRulesHits Flag to collect cosmetic rules hits.
     * @returns Array of extended css rules or null.
     */
    public static getExtCssRules(
        cosmeticResult: CosmeticResult,
        collectingCosmeticRulesHits = false,
    ): string[] | null {
        const { elementHiding, CSS } = cosmeticResult;

        const elemhideExtCss = elementHiding.genericExtCss.concat(elementHiding.specificExtCss);
        const injectExtCss = CSS.genericExtCss.concat(CSS.specificExtCss);

        let extCssRules: string[];

        if (collectingCosmeticRulesHits) {
            extCssRules = CosmeticApi.buildStyleSheetsWithHits(elemhideExtCss, injectExtCss);
        } else {
            extCssRules = CosmeticApi.buildStyleSheets(elemhideExtCss, injectExtCss, false);
        }

        return extCssRules.length > 0
            ? extCssRules
            : null;
    }

    /**
     * Builds scripts from cosmetic rules.
     *
     * @param rules Cosmetic rules.
     * @param frameUrl Frame url.
     * @returns Script text or empty string if no script rules are passed.
     */
    public static getScriptText(rules: CosmeticRule[], frameUrl?: string): string {
        if (rules.length === 0) {
            return '';
        }

        const permittedRules = CosmeticApi.sanitizeScriptRules(rules);

        let debug = false;
        const { configuration } = appContext;
        if (configuration) {
            const { settings } = configuration;
            if (settings) {
                // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2584
                debug = settings.debugScriptlets;
            }
        }

        const scriptParams = {
            debug,
            frameUrl,
        };

        const scriptText = permittedRules
            .map((rule) => rule.getScript(scriptParams))
            .join('\n');

        if (!scriptText) {
            return '';
        }

        return `
        (function () {
            try {
                ${scriptText}
            } catch (ex) {
                console.error('Error executing AG js: ' + ex);
            }
        })();
        `;
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
     * Applies css rules to specific frame.
     *
     * @param params Data for css rules injecting.
     */
    public static async applyCssRules(params: ApplyCosmeticRulesParams): Promise<void> {
        const {
            tabId,
            frameId,
            cosmeticResult,
        } = params;

        const { configuration } = appContext;

        const areHitsStatsCollected = configuration?.settings.collectStats || false;

        const cssText = CosmeticApi.getCssText(cosmeticResult, areHitsStatsCollected);

        if (cssText) {
            await CosmeticApi.injectCss(cssText, tabId, frameId);
        }
    }

    /**
     * Applies js rules to specific frame.
     *
     * @param params Data for js rule injecting.
     */
    public static async applyJsRules(params: ApplyCosmeticRulesParams): Promise<void> {
        const {
            tabId,
            frameId,
            cosmeticResult,
            url,
        } = params;

        const scriptRules = cosmeticResult.getScriptRules();

        let scriptText = CosmeticApi.getScriptText(scriptRules, url);

        const tabContext = tabsApi.getTabContext(tabId);
        if (tabContext) {
            const frame = tabContext.frames.get(frameId);
            scriptText += stealthApi.getStealthScript(tabContext.mainFrameRule, frame?.matchingResult);
        }

        if (scriptText) {
            /**
             * We can execute injectScript only once per frame, so we need to
             * combine all the scripts into a single injection.
             *
             * @see {@link buildScriptText} for details about multiple injects.
             * @see {@link LocalScriptRulesService} for details about script source
             */
            await CosmeticApi.injectScript(scriptText, tabId, frameId);
        }
    }

    /**
     * Logs js rules to specific frame.
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

        const permittedScriptRules = CosmeticApi.sanitizeScriptRules(scriptRules);

        for (const scriptRule of permittedScriptRules) {
            if (!scriptRule.isGeneric()) {
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
                        rule: scriptRule,
                    },
                });
            }
        }
    }

    /**
     * Injects js to specified frame based on provided data and injection FSM state.
     *
     * @param frameId Frame id.
     * @param tabId Tab id.
     */
    public static async applyFrameJsRules(frameId: number, tabId: number): Promise<void> {
        return CosmeticApi.applyFrameCosmeticRules(
            frameId,
            tabId,
            CosmeticApi.applyJsRules,
        );
    }

    /**
     * Injects css to specified frame based on provided data and injection FSM state.
     *
     * @param frameId Frame id.
     * @param tabId Tab id.
     */
    public static async applyFrameCssRules(frameId: number, tabId: number): Promise<void> {
        return CosmeticApi.applyFrameCosmeticRules(
            frameId,
            tabId,
            CosmeticApi.applyCssRules,
        );
    }

    /**
     * Injects cosmetic result to specified frame based on data provided via context.
     *
     * @param frameId Frame id.
     * @param tabId Tab id.
     * @param injector Inject function.
     * @param tries Number of tries for the injection in case of failure.
     */
    private static async applyFrameCosmeticRules(
        frameId: number,
        tabId: number,
        injector: (params: ApplyCosmeticRulesParams) => Promise<void>,
        tries = 0,
    ): Promise<void> {
        try {
            // We read a cosmetic result on execution, because the tab context can change while retrying the injection.
            const frame = tabsApi.getTabFrame(tabId, frameId);

            if (frame?.cosmeticResult) {
                await injector({
                    frameId,
                    tabId,
                    url: frame.url,
                    cosmeticResult: frame.cosmeticResult,
                });
            }
        } catch (e) {
            if (tries < CosmeticApi.INJECTION_MAX_TRIES) {
                setTimeout(() => {
                    CosmeticApi.applyFrameCosmeticRules(frameId, tabId, injector, tries + 1);
                }, CosmeticApi.INJECTION_RETRY_TIMEOUT_MS);
            } else {
                logger.debug(getErrorMessage(e));
            }
        }
    }

    /**
     * Filters insecure scripts from remote sources.
     *
     * @param rules Cosmetic rules.
     * @returns Permitted script rules.
     */
    private static sanitizeScriptRules(rules: CosmeticRule[]): CosmeticRule[] {
        return rules.filter((rule) => {
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
            const text = rule.getText();
            return localScriptRulesService.isLocal(text);
        });
    }

    /**
     * Encodes rule text.
     *
     * @param ruleText Rule text.
     * @returns Encoded rule text.
     */
    private static escapeRule(ruleText: string): string {
        return encodeURIComponent(ruleText).replace(
            /['()]/g,
            (match) => ({ "'": '%27', '(': '%28', ')': '%29' }[match] as string),
        );
    }

    /**
     * Patches rule selector adding adguard mark rule info in the content attribute.
     * Example:
     * .selector -> .selector { content: 'adguard{filterId};{ruleText} !important;}.
     *
     * @param rule Elemhide cosmetic rule.
     *
     * @returns Rule with modified stylesheet, containing content marker.
     */
    private static addMarkerToElemhideRule(rule: CosmeticRule): string {
        const result = [];
        result.push(rule.getContent());
        result.push(CosmeticApi.ELEMHIDE_HIT_START);
        result.push(rule.getFilterListId());
        result.push(CosmeticApi.HIT_SEP);
        result.push(CosmeticApi.escapeRule(rule.getText()));
        result.push(CosmeticApi.HIT_END);
        return result.join('');
    }

    /**
     * Patches rule selector adding adguard mark and rule info in the content style attribute.
     * Example:
     * .selector { color: red } -> .selector { color: red, content: 'adguard{filterId};{ruleText} !important;}.
     *
     * @param rule Inject cosmetic rule.
     *
     * @returns Modified rule with injected content marker into stylesheet.
     */
    private static addMarkerToInjectRule(rule: CosmeticRule): string {
        const result = [];
        const ruleContent = rule.getContent();
        // if rule text has content attribute we don't add rule marker
        const contentAttributeRegex = /[{;"(]\s*content\s*:/gi;
        if (contentAttributeRegex.test(ruleContent)) {
            return ruleContent;
        }

        // remove closing brace
        const ruleTextWithoutCloseBrace = ruleContent.slice(0, -1).trim();
        // check semicolon
        const ruleTextWithSemicolon = ruleTextWithoutCloseBrace.endsWith(';')
            ? ruleTextWithoutCloseBrace
            : `${ruleTextWithoutCloseBrace};`;
        result.push(ruleTextWithSemicolon);
        result.push(CosmeticApi.INJECT_HIT_START);
        result.push(rule.getFilterListId());
        result.push(CosmeticApi.HIT_SEP);
        result.push(CosmeticApi.escapeRule(rule.getText()));
        result.push(CosmeticApi.HIT_END);

        return result.join('');
    }

    /**
     * Builds stylesheets with css-hits marker.
     *
     * @param elemhideRules Elemhide css rules.
     * @param injectRules Inject css rules.
     *
     * @returns List of stylesheet expressions.
     */
    private static buildStyleSheetsWithHits(
        elemhideRules: CosmeticRule[],
        injectRules: CosmeticRule[],
    ): string[] {
        const elemhideStyles = elemhideRules.map((x) => CosmeticApi.addMarkerToElemhideRule(x));
        const injectStyles = injectRules.map((x) => CosmeticApi.addMarkerToInjectRule(x));

        return [...elemhideStyles, ...injectStyles];
    }
}
