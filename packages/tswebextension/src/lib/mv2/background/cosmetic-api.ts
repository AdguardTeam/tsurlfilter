import { nanoid } from 'nanoid';
import type {
    CosmeticResult,
    CosmeticRule,
} from '@adguard/tsurlfilter';

import { appContext } from './context';
import { getDomain } from '../../common/utils/url';
import { USER_FILTER_ID } from '../../common/constants';
import { defaultFilteringLog, FilteringEventType } from '../../common/filtering-log';
import { buildScriptText } from './injection-helper';
import { localScriptRulesService } from './services/local-script-rules-service';
import { stealthApi } from './stealth-api';
import { TabsApi, tabsApi } from './tabs/tabs-api';
import { getErrorMessage } from '../../common/error';
import {
    type InjectionFsm,
    InjectionEvent,
    InjectionState,
} from './tabs/injectionFsm';
import { logger } from '../../common/utils/logger';

import type { ContentType } from '../../common/request-type';

export type ApplyJsRulesParams = {
    tabId: number,
    frameId: number,
    cosmeticResult: CosmeticResult,
    url: string,
    requestId: string,
    contentType: ContentType,
    timestamp: number,
};

export type ApplyCssRulesParams = {
    tabId: number,
    frameId: number,
    cosmeticResult: CosmeticResult,
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
export class CosmeticApi {
    private static readonly ELEMHIDE_HIT_START = " { display: none !important; content: 'adguard";

    private static readonly INJECT_HIT_START = " content: 'adguard";

    private static readonly HIT_SEP = encodeURIComponent(';');

    private static readonly HIT_END = "' !important; }";

    private static readonly LINE_BREAK = '\r\n';

    // Number of selectors in grouped selector list
    private static readonly CSS_SELECTORS_PER_LINE = 50;

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
     * @returns Scripts or undefined.
     */
    public static getScriptText(rules: CosmeticRule[]): string | undefined {
        if (rules.length === 0) {
            return undefined;
        }

        const scriptText = rules
            .filter((rule) => {
                // Scriptlets should not be excluded for remote filters
                if (rule.isScriptlet) {
                    return true;
                }

                // User rules should not be excluded from remote filters
                const filterId = rule.getFilterListId();
                if (filterId === USER_FILTER_ID) {
                    return true;
                }

                /**
                 * @see {@link LocalScriptRulesService} for details about script source
                 */
                const text = rule.getText();
                return localScriptRulesService.isLocal(text);
            })
            .map((rule) => rule.getScript())
            .join('\n');

        if (!scriptText) {
            return undefined;
        }

        return scriptText;
    }

    /**
     * Returns content script data for applying cosmetic.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @returns Content script data for applying cosmetic.
     */
    public static getContentScriptData(tabId: number, frameId: number): ContentScriptCosmeticData {
        const { isAppStarted, configuration } = appContext;

        const areHitsStatsCollected = configuration?.settings.collectStats || false;

        const data: ContentScriptCosmeticData = {
            isAppStarted,
            areHitsStatsCollected,
            extCssRules: null,
        };

        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (!frame?.cosmeticResult) {
            return data;
        }

        data.extCssRules = CosmeticApi.getExtCssRules(frame.cosmeticResult, areHitsStatsCollected);

        return data;
    }

    /**
     * Applies css rules to specific frame.
     *
     * @param params Data for css rules injecting.
     */
    public static async applyCssRules(params: ApplyCssRulesParams): Promise<void> {
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
     * @param params Data for js rule injecting and logging.
     */
    public static async applyJsRules(params: ApplyJsRulesParams): Promise<void> {
        const {
            tabId,
            frameId,
            cosmeticResult,
            url,
            contentType,
            timestamp,
        } = params;

        const scriptRules = cosmeticResult.getScriptRules();

        let scriptText = CosmeticApi.getScriptText(scriptRules);
        scriptText += stealthApi.getSetDomSignalScript();

        if (scriptText) {
            /**
             * We can execute injectScript only once per frame, so we need to
             * combine all the scripts into a single injection.
             *
             * @see {@link buildScriptText} for details about multiple injects.
             * @see {@link LocalScriptRulesService} for details about script source
             */
            await CosmeticApi.injectScript(scriptText, tabId, frameId);

            for (const scriptRule of scriptRules) {
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
    }

    /**
     * Apply js to specified frame based on provided data and injection FSM state.
     *
     * @param params The data required for the injection.
     * @param fsm Injection finite state machine.
     * @param tries The number of tries for the operation in case of failure.
     */
    public static applyFrameJsRules(
        params: ApplyJsRulesParams,
        fsm: InjectionFsm,
        tries = 0,
    ): void {
        if (fsm.state !== InjectionState.Idle) {
            return;
        }

        fsm.dispatch(InjectionEvent.Start);

        CosmeticApi
            .applyJsRules(params)
            .then(() => {
                fsm.dispatch(InjectionEvent.Success);
            }).catch((e) => {
                fsm.dispatch(InjectionEvent.Failure);

                if (tries < CosmeticApi.INJECTION_MAX_TRIES) {
                    setTimeout(() => {
                        CosmeticApi.applyFrameJsRules(params, fsm, tries + 1);
                    }, CosmeticApi.INJECTION_RETRY_TIMEOUT_MS);
                } else {
                    logger.debug(getErrorMessage(e));
                }
            });
    }

    /**
     * Injects css to specified frame based on provided data and injection FSM state.
     *
     * @param params Data required for the injection.
     * @param fsm Injection finite state machine.
     * @param tries Number of tries for the operation in case of failure.
     */
    public static applyFrameCssRules(
        params: ApplyCssRulesParams,
        fsm: InjectionFsm,
        tries = 0,
    ): void {
        if (fsm.state !== InjectionState.Idle) {
            return;
        }

        fsm.dispatch(InjectionEvent.Start);

        CosmeticApi
            .applyCssRules(params)
            .then(() => {
                fsm.dispatch(InjectionEvent.Success);
            }).catch((e) => {
                fsm.dispatch(InjectionEvent.Failure);

                if (tries < CosmeticApi.INJECTION_MAX_TRIES) {
                    setTimeout(() => {
                        CosmeticApi.applyFrameCssRules(params, fsm, tries + 1);
                    }, CosmeticApi.INJECTION_RETRY_TIMEOUT_MS);
                } else {
                    logger.debug(getErrorMessage(e));
                }
            });
    }

    /**
     * Builds element hiding stylesheet from rules.
     * If `groupElemhideSelectors` is set,
     * selector are to be combined into selector lists of {@link CosmeticApi.CSS_SELECTORS_PER_LINE}.
     *
     * @param elemhideRules List of elemhide rules.
     * @param groupElemhideSelectors Flag for elemhide selectors grouping.
     *
     * @returns Array of styles.
     */
    private static buildElemhideStyles(
        elemhideRules: CosmeticRule[],
        groupElemhideSelectors: boolean,
    ): string[] {
        // TODO: refactor constants as ELEMHIDE_CSS_STYLE and ELEMHIDE_HIT_START are duplicates partly
        const ELEMHIDE_CSS_STYLE = ' { display: none !important; }';

        const elemhideSelectors = [];

        for (const selector of elemhideRules) {
            elemhideSelectors.push(selector.getContent());
        }

        // if selector should not be grouped,
        // add element hiding style to each of them
        if (!groupElemhideSelectors) {
            return elemhideSelectors.map((selector) => {
                return `${selector}${ELEMHIDE_CSS_STYLE}`;
            });
        }

        // otherwise selectors should be grouped into selector lists
        const elemhideStyles = [];
        for (let i = 0; i < elemhideSelectors.length; i += CosmeticApi.CSS_SELECTORS_PER_LINE) {
            const selectorList = elemhideSelectors
                .slice(i, i + CosmeticApi.CSS_SELECTORS_PER_LINE)
                .join(', ');
            elemhideStyles.push(`${selectorList}${ELEMHIDE_CSS_STYLE}`);
        }
        return elemhideStyles;
    }

    /**
     * Builds stylesheets from rules.
     * If `groupElemhideSelectors` is set,
     * element hiding selector are to be combined into selector lists of {@link CosmeticApi.CSS_SELECTORS_PER_LINE}.
     *
     * @param elemhideRules List of elemhide rules.
     * @param injectRules List of inject css rules.
     * @param groupElemhideSelectors Flag for elemhide selectors grouping.
     *
     * @returns List of stylesheet expressions.
     */
    private static buildStyleSheets(
        elemhideRules: CosmeticRule[],
        injectRules: CosmeticRule[],
        groupElemhideSelectors: boolean,
    ): string[] {
        const styles = [];

        const elemHideStyles = CosmeticApi.buildElemhideStyles(elemhideRules, groupElemhideSelectors);
        if (elemHideStyles.length > 0) {
            if (groupElemhideSelectors) {
                styles.push(elemHideStyles.join(CosmeticApi.LINE_BREAK));
            } else {
                styles.push(...elemHideStyles);
            }
        }

        const cssStyles = injectRules.map((x: CosmeticRule) => x.getContent());
        if (cssStyles.length > 0) {
            if (groupElemhideSelectors) {
                styles.push(cssStyles.join(CosmeticApi.LINE_BREAK));
            } else {
                styles.push(...cssStyles);
            }
        }

        return styles;
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
