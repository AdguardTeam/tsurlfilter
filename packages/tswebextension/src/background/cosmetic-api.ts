import browser, { ExtensionTypes } from 'webextension-polyfill';
import { CosmeticResult, CosmeticRule } from '@adguard/tsurlfilter';

import { buildScriptText, buildExtendedCssScriptText } from './injection-helper.js';

export interface CosmeticApiInterface {
    /**
     * Applies scripts from cosmetic result
     */
    applyScripts: (tabId: number, cosmeticResult: CosmeticResult) => void;

    /**
     * Applies css from cosmetic result
     *
     * Patches rule selector adding adguard mark rule info in the content attribute
     * Example:
     * .selector -> .selector { content: 'adguard{filterId};{ruleText} !important;}
     */
    applyCss: (tabId: number, cosmeticResult: CosmeticResult) => void;

}

export class CosmeticApi implements CosmeticApiInterface {

    public applyScripts(tabId: number, cosmeticResult: CosmeticResult): void {
        const rules = cosmeticResult.getScriptRules();

        if (rules.length === 0) {
            return;
        }

        const scriptText = rules.map((rule) => rule.script).join('\r\n');

        if (!scriptText) {
            return;
        }

        const code = buildScriptText(scriptText);

        browser.tabs.executeScript(tabId, { code });
    }

    public applyCss(tabId: number, cosmeticResult: CosmeticResult): void {
        const ADD_CSS_HITS_MARKER = true;

        const elemhideCss = [...cosmeticResult.elementHiding.generic, ...cosmeticResult.elementHiding.specific]
            .map((x) => this.createRuleStyle(x, ADD_CSS_HITS_MARKER));
    
        const injectCss = [...cosmeticResult.CSS.generic, ...cosmeticResult.CSS.specific]
            .map((x) => this.createInjectRuleStyle(x, ADD_CSS_HITS_MARKER));
    
        const elemhideExtendedCssStylesheets = [
            ...cosmeticResult.elementHiding.genericExtCss,
            ...cosmeticResult.elementHiding.specificExtCss,
        ]
            .map((x) => this.createRuleStyle(x, ADD_CSS_HITS_MARKER).replace('\\', '\\\\'));
    
        const injectExtendedCssStylesheets = [
            ...cosmeticResult.CSS.genericExtCss,
            ...cosmeticResult.CSS.specificExtCss,
        ]
            .map((x) => this.createInjectRuleStyle(x, ADD_CSS_HITS_MARKER).replace('\\', '\\\\'));
    
        const extendedCssStylesheets = [...elemhideExtendedCssStylesheets, ...injectExtendedCssStylesheets].join('\n');
    
        // Apply extended css
        browser.tabs.executeScript(tabId, {
            code: buildExtendedCssScriptText(extendedCssStylesheets),
        });
    
        // Apply css
        const styleText = [...elemhideCss, ...injectCss].join('\n');
        
        const injectDetails = {
            code: styleText,
            runAt: 'document_start',
        } as ExtensionTypes.InjectDetails;
    
        browser.tabs.insertCSS(tabId, injectDetails);
    }

    /**
     * Urlencodes rule text.
     */
    private escapeRule(ruleText: string): string {
        return encodeURIComponent(ruleText).replace(
            /['()]/g,
            (match) => ({ "'": '%27', '(': '%28', ')': '%29' }[match] as string),
        );
    }

    /**
     * Creates rules style string
     */
    private createRuleStyle(rule: CosmeticRule, addMarker: boolean): string {
        let contentMarker = '';
        if (addMarker) {
            // eslint-disable-next-line max-len
            contentMarker = ` content: 'adguard${rule.getFilterListId()}${encodeURIComponent(';')}${this.escapeRule(rule.getText())}' !important;`;
        }

        return `${rule.getContent()} { display: none!important;${contentMarker}}`;
    }

    /**
     * Creates rules style string
     */
    private createInjectRuleStyle(rule: CosmeticRule, addMarker: boolean): string {
        let contentMarker = '';
        if (addMarker) {
            // eslint-disable-next-line max-len
            contentMarker = ` content: 'adguard${rule.getFilterListId()}${encodeURIComponent(';')}${this.escapeRule(rule.getText())}' !important;`;
        }

        const content = rule.getContent().trim();
        if (content.endsWith('}')) {
            return `${content.substr(0, content.length - 1)}${contentMarker}}`;
        }

        return content;
    }


}

export const cosmeticApi = new CosmeticApi();