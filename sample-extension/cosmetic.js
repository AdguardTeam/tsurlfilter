/* eslint-disable no-console, no-undef, import/extensions */
import { buildScriptText } from './injection-helper.js';

/**
 * Applies scripts from cosmetic result
 *
 * @param tabId
 * @param cosmeticResult
 */
export const applyScripts = (tabId, cosmeticResult) => {
    const cosmeticRules = cosmeticResult.getScriptRules();
    if (cosmeticRules.length === 0) {
        return;
    }

    const scriptsCode = cosmeticRules.map((x) => x.script).join('\r\n');
    const toExecute = buildScriptText(scriptsCode);

    chrome.tabs.executeScript(tabId, {
        code: toExecute,
    });
};

/**
 * Urlencodes rule text.
 *
 * @param ruleText
 * @return {string}
 */
const escapeRule = (ruleText) => encodeURIComponent(ruleText)
    .replace(/['()]/g, (match) => ({ "'": '%27', '(': '%28', ')': '%29' }[match]));

/**
 * Creates rules style string
 *
 * @param rule
 * @return {string}
 */
const mapRuleStyle = (rule) => {
    // eslint-disable-next-line max-len
    const contentMarker = `content: 'adguard${rule.getFilterListId()}${encodeURIComponent(';')}${escapeRule(rule.getText())}' !important`;

    return `${rule.getContent()} { display: none!important; ${contentMarker};}`;
};

/**
 * Applies css from cosmetic result
 *
 * Patches rule selector adding adguard mark rule info in the content attribute
 * Example:
 * .selector -> .selector { content: 'adguard{filterId};{ruleText} !important;}
 *
 * @param tabId
 * @param cosmeticResult
 */
export const applyCss = (tabId, cosmeticResult) => {
    const css = [...cosmeticResult.elementHiding.generic, ...cosmeticResult.elementHiding.specific]
        .map(mapRuleStyle);

    const extendedCssStylesheets = [
        ...cosmeticResult.elementHiding.genericExtCss,
        ...cosmeticResult.elementHiding.specificExtCss,
    ]
        .map(mapRuleStyle)
        .join('\n');

    // Apply extended css stylesheets
    chrome.tabs.executeScript(tabId, {
        code: `
                (() => {
                    const { ExtendedCss } = AGUrlFilter;
                    const extendedCssContent = \`${extendedCssStylesheets}\`;
                    const extendedCss = new ExtendedCss({
                        styleSheet: extendedCssContent
                    });
                    extendedCss.apply();
                    
                    console.debug('Extended css applied');
                })();
            `,
    });

    // Init css hits counter
    chrome.tabs.executeScript(tabId, {
        code: `
                (() => {
                    // Init css hits counter
                    const { CssHitsCounter } = AGUrlFilter;
                    window.cssCssHitsCounter = new CssHitsCounter((stats) => {
                        console.debug('Css stats ready');
                        console.debug(stats);
                        
                        chrome.runtime.sendMessage({type: "saveCssHitStats", stats: JSON.stringify(stats)});
                    });
                    
                    console.debug('CssHitsCounter initialized');
                })();
            `,
    });

    // Apply css
    const styleText = css.join('\n');
    const injectDetails = {
        code: styleText,
        runAt: 'document_start',
    };

    chrome.tabs.insertCSS(tabId, injectDetails);
};
