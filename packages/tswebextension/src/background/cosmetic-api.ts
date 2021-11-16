import { CosmeticResult, CosmeticRule } from '@adguard/tsurlfilter';

import { buildScriptText, buildExtendedCssScriptText } from './injection-helper.js';
import { tabsApi } from './tabs/tabs-api.js';

export interface CosmeticApiInterface {
    /**
     * Applies scripts from cosmetic result
     */
    injectScript: (scriptText: string, tabId: number, frameId?: number) => void;

    /**
     * Applies css from cosmetic result
     *
     * Patches rule selector adding adguard mark rule info in the content attribute
     * Example:
     * .selector -> .selector { content: 'adguard{filterId};{ruleText} !important;}
     */
    injectCss: (cssText: string, tabId: number, frameId?: number) => void;

    injectExtCss: (extCssText: string, tabId: number, frameId?: number) => void;

    getCssText: (cosmeticResult: CosmeticResult) => string | undefined;

    getExtCssText: (cosmeticResult: CosmeticResult, collectingCosmeticRulesHits?: boolean ) => string | undefined;

    getScriptText: (cosmeticResult: CosmeticResult, collectingCosmeticRulesHits?: boolean ) => string | undefined;

}

export class CosmeticApi implements CosmeticApiInterface {

    private ELEMHIDE_HIT_START = " { display: none!important; content: 'adguard";

    private INJECT_HIT_START = " content: 'adguard";

    private HIT_SEP = encodeURIComponent(';');

    private HIT_END = "' !important;}\r\n";
    
    public injectScript(scriptText: string, tabId: number, frameId = 0): void {
        tabsApi.injectScript(buildScriptText(scriptText), tabId, frameId);
    }

    public injectCss(cssText: string, tabId: number, frameId = 0): void {
        tabsApi.injectCss(cssText, tabId, frameId);
    }

    public injectExtCss(extCssText: string, tabId: number, frameId = 0): void {
        tabsApi.injectScript(buildExtendedCssScriptText(extCssText), tabId, frameId);
    }

    public getCssText(cosmeticResult: CosmeticResult, collectingCosmeticRulesHits = false): string | undefined {
        const { elementHiding, CSS } = cosmeticResult;

        const elemhideCss = elementHiding.generic.concat(elementHiding.specific);
        const injectCss = CSS.generic.concat(CSS.specific);

        let styles: string[];

        if (collectingCosmeticRulesHits) {
            styles = this.buildStyleSheetWithHits(elemhideCss, injectCss);
        } else {
            styles = this.buildStyleSheet(elemhideCss, injectCss, true);
        }

        if (styles.length > 0){
            return styles.join('\n');
        }
            
        return;
    }

    public getExtCssText(cosmeticResult: CosmeticResult, collectingCosmeticRulesHits = false): string | undefined {
        const { elementHiding, CSS } = cosmeticResult;

        const elemhideExtCss = elementHiding.genericExtCss.concat(elementHiding.specificExtCss);
        const injectExtCss = CSS.genericExtCss.concat(CSS.specificExtCss);

        let extStyles: string[];

        if (collectingCosmeticRulesHits) {
            extStyles = this.buildStyleSheetWithHits(elemhideExtCss, injectExtCss);
        } else {
            extStyles = this.buildStyleSheet(elemhideExtCss, injectExtCss, false);
        }

        if (extStyles.length > 0){
            return extStyles.join('\n');
        }

        return;
    }

    public getScriptText(cosmeticResult: CosmeticResult): string | undefined {
        const rules = cosmeticResult.getScriptRules();

        if (rules.length === 0) {
            return;
        }

        const scriptText = rules.map((rule) => rule.script).join('\n');

        if (!scriptText) {
            return;
        }

        return scriptText;
    }

    /**
     * Builds stylesheet from rules
     */
    private buildStyleSheet(
        elemhideRules: CosmeticRule[],
        injectRules: CosmeticRule[], 
        groupElemhideSelectors: boolean,
    ) {
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
        const cssStyle = injectRules.map(x => x.getContent()).join('\r\n');

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
     * Urlencodes rule text.
     *
     * @param ruleText
     * @return {string}
     */
    private escapeRule(ruleText: string): string {
        return encodeURIComponent(ruleText).replace(
            /['()]/g,
            (match) => ({ "'": '%27', '(': '%28', ')': '%29' }[match] as string),
        );
    }

    /**
     * Patch rule selector adding adguard mark rule info in the content attribute
     * Example:
     * .selector -> .selector { content: 'adguard{filterId};{ruleText} !important;}
     */
    private addMarkerToElemhideRule(rule: CosmeticRule){
        const result = [];
        result.push(rule.getContent());
        result.push(this.ELEMHIDE_HIT_START);
        result.push(rule.getFilterListId());
        result.push(this.HIT_SEP);
        result.push(this.escapeRule(rule.getText()));
        result.push(this.HIT_END);
        return result.join('');
    }

    /**
     * Patch rule selector adding adguard mark and rule info in the content attribute
     * Example:
     * .selector { color: red } -> .selector { color: red, content: 'adguard{filterId};{ruleText} !important;}
     */
    private addMarkerToInjectRule(rule: CosmeticRule){
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
        result.push(this.INJECT_HIT_START);
        result.push(rule.getFilterListId());
        result.push(this.HIT_SEP);
        result.push(this.escapeRule(rule.getText()));
        result.push(this.HIT_END);

        return result.join('');
    }

    /**
     * Builds stylesheet with css-hits marker
     */
    private buildStyleSheetWithHits = (
        elemhideRules: CosmeticRule[],
        injectRules: CosmeticRule[],
    ) => {
        const elemhideStyles = elemhideRules.map(x => this.addMarkerToElemhideRule(x));
        const injectStyles = injectRules.map(x => this.addMarkerToInjectRule(x));

        return [...elemhideStyles, ...injectStyles];
    };
}

export const cosmeticApi = new CosmeticApi();