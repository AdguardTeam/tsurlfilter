import { CosmeticResult, CosmeticRule } from '@adguard/tsurlfilter';

import { buildScriptText, buildExtendedCssScriptText } from './injection-helper';
import { localScriptRulesService } from './services/local-script-rules-service';
import { tabsApi } from './tabs/tabs-api';
import { USER_FILTER_ID } from '../../common/constants';

export class CosmeticApi {
    private static ELEMHIDE_HIT_START = " { display: none!important; content: 'adguard";

    private static INJECT_HIT_START = " content: 'adguard";

    private static HIT_SEP = encodeURIComponent(';');

    private static HIT_END = "' !important;}\r\n";

    /**
     * Applies scripts from cosmetic result
     *
     * @param scriptText - script text
     * @param tabId - tab id
     * @param frameId - frame id
     * @see {@link LocalScriptRulesService} for details about script source
     */
    public static injectScript(scriptText: string, tabId: number, frameId = 0): void {
        tabsApi.injectScript(buildScriptText(scriptText), tabId, frameId);
    }

    /**
     * Applies css from cosmetic result
     *
     * Patches rule selector adding adguard mark rule info in the content attribute
     * Example:
     * .selector -> .selector { content: 'adguard{filterId};{ruleText} !important;}
     *
     * @param cssText - css text
     * @param tabId - tab id
     * @param frameId - frame id
     */
    public static injectCss(cssText: string, tabId: number, frameId = 0): void {
        tabsApi.injectCss(cssText, tabId, frameId);
    }

    // TODO: check why is not called
    public static injectExtCss(extCssText: string, tabId: number, frameId = 0): void {
        tabsApi.injectScript(buildExtendedCssScriptText(extCssText), tabId, frameId);
    }

    public static getCssText(cosmeticResult: CosmeticResult, collectingCosmeticRulesHits = false): string | undefined {
        const { elementHiding, CSS } = cosmeticResult;

        const elemhideCss = elementHiding.generic.concat(elementHiding.specific);
        const injectCss = CSS.generic.concat(CSS.specific);

        let styles: string[];

        if (collectingCosmeticRulesHits) {
            styles = CosmeticApi.buildStyleSheetWithHits(elemhideCss, injectCss);
        } else {
            styles = CosmeticApi.buildStyleSheet(elemhideCss, injectCss, true);
        }

        if (styles.length > 0) {
            return styles.join('\n');
        }
    }

    public static getExtCssText(
        cosmeticResult: CosmeticResult,
        collectingCosmeticRulesHits = false,
    ): string | undefined {
        const { elementHiding, CSS } = cosmeticResult;

        const elemhideExtCss = elementHiding.genericExtCss.concat(elementHiding.specificExtCss);
        const injectExtCss = CSS.genericExtCss.concat(CSS.specificExtCss);

        let extStyles: string[];

        if (collectingCosmeticRulesHits) {
            extStyles = CosmeticApi.buildStyleSheetWithHits(elemhideExtCss, injectExtCss);
        } else {
            extStyles = CosmeticApi.buildStyleSheet(elemhideExtCss, injectExtCss, false);
        }

        if (extStyles.length > 0) {
            return extStyles.join('\n');
        }
    }

    public static getScriptText(rules: CosmeticRule[]): string | undefined {
        if (rules.length === 0) {
            return;
        }

        const scriptText = rules
            .filter((rule) => {
                const filterId = rule.getFilterListId();

                if (filterId === USER_FILTER_ID) {
                    return true;
                }

                const text = rule.getText();

                /**
                 * @see {@link LocalScriptRulesService} for details about script source
                 */
                return localScriptRulesService.isLocal(text);
            })
            .map((rule) => rule.getScript())
            .join('\n');

        if (!scriptText) {
            return;
        }

        return scriptText;
    }

    public static getFrameExtCssText(tabId: number, frameId: number): string | undefined {
        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (!frame?.requestContext) {
            return;
        }

        const { requestContext } = frame;

        if (!requestContext?.cosmeticResult) {
            return;
        }

        const { cosmeticResult } = requestContext;

        const extCssText = CosmeticApi.getExtCssText(cosmeticResult, true);

        return extCssText;
    }

    /**
     * Builds stylesheet from rules
     *
     * @param elemhideRules - list of elemhide css rules
     * @param injectRules - list of inject css rules
     * @param groupElemhideSelectors - is hidden elements selectors will be grouped
     *
     * @returns list of stylesheet expressions
     */
    private static buildStyleSheet(
        elemhideRules: CosmeticRule[],
        injectRules: CosmeticRule[],
        groupElemhideSelectors: boolean,
    ): string[] {
        const CSS_SELECTORS_PER_LINE = 50;
        const ELEMHIDE_CSS_STYLE = ' { display: none!important; }\r\n';

        const elemhides = [];

        let selectorsCount = 0;
        // eslint-disable-next-line no-restricted-syntax
        for (const selector of elemhideRules) {
            selectorsCount += 1;

            elemhides.push(selector.getContent());

            if (selectorsCount % CSS_SELECTORS_PER_LINE === 0 || !groupElemhideSelectors) {
                elemhides.push(ELEMHIDE_CSS_STYLE);
            } else {
                elemhides.push(', ');
            }
        }

        if (elemhides.length > 0) {
            // Last element should always be a style (it will replace either a comma or the same style)
            elemhides[elemhides.length - 1] = ELEMHIDE_CSS_STYLE;
        }

        const elemHideStyle = elemhides.join('');
        const cssStyle = injectRules.map((x) => x.getContent()).join('\r\n');

        const styles = [];
        if (elemHideStyle) {
            styles.push(elemHideStyle);
        }

        if (cssStyle) {
            styles.push(cssStyle);
        }

        return styles;
    }

    /**
     * Encodes rule text.
     *
     * @param ruleText - rule text
     * @returns encoded rule text
     */
    private static escapeRule(ruleText: string): string {
        return encodeURIComponent(ruleText).replace(
            /['()]/g,
            (match) => ({ "'": '%27', '(': '%28', ')': '%29' }[match] as string),
        );
    }

    /**
     * Patch rule selector adding adguard mark rule info in the content attribute
     * Example:
     * .selector -> .selector { content: 'adguard{filterId};{ruleText} !important;}
     *
     * @param rule - elemhide cosmetic rule
     *
     * @returns - stylesheet expression with marker
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
     * Patch rule selector adding adguard mark and rule info in the content attribute
     * Example:
     * .selector { color: red } -> .selector { color: red, content: 'adguard{filterId};{ruleText} !important;}
     *
     * @param rule - inject cosmetic rule
     *
     * @returns - stylesheet expression with marker
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
     * Builds stylesheet with css-hits marker
     *
     * @param elemhideRules - elemhide css rules
     * @param injectRules - inject css rules
     *
     * @returns list of stylesheet expressions
     */
    private static buildStyleSheetWithHits = (
        elemhideRules: CosmeticRule[],
        injectRules: CosmeticRule[],
    ): string[] => {
        const elemhideStyles = elemhideRules.map((x) => CosmeticApi.addMarkerToElemhideRule(x));
        const injectStyles = injectRules.map((x) => CosmeticApi.addMarkerToInjectRule(x));

        return [...elemhideStyles, ...injectStyles];
    };
}
