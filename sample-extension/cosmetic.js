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
 * @param addMarker
 * @return {string}
 */
const createRuleStyle = (rule, addMarker) => {
    let contentMarker = '';
    if (addMarker) {
        // eslint-disable-next-line max-len
        contentMarker = ` content: 'adguard${rule.getFilterListId()}${encodeURIComponent(';')}${escapeRule(rule.getText())}' !important;`;
    }

    return `${rule.getContent()} { display: none!important;${contentMarker}}`;
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
    const ADD_CSS_HITS_MARKER = true;

    const css = [...cosmeticResult.elementHiding.generic, ...cosmeticResult.elementHiding.specific]
        .map((x) => createRuleStyle(x, ADD_CSS_HITS_MARKER));

    const extendedCssStylesheets = [
        ...cosmeticResult.elementHiding.genericExtCss,
        ...cosmeticResult.elementHiding.specificExtCss,
    ]
        .map((x) => createRuleStyle(x, ADD_CSS_HITS_MARKER))
        .join('\n');

    chrome.tabs.executeScript(tabId, {
        code: `
                (() => {
                    // Init css hits counter
                    const { CssHitsCounter } = AGUrlFilter;
                    const cssHitsCounter = new CssHitsCounter((stats) => {
                        console.debug('Css stats ready');
                        console.debug(stats);
                        
                        chrome.runtime.sendMessage({type: "saveCssHitStats", stats: JSON.stringify(stats)});
                    });
                    
                    console.debug('CssHitsCounter initialized');
                    
                    // Apply extended css stylesheets
                    const { ExtendedCss } = AGUrlFilter;
                    const extendedCssContent = \`${extendedCssStylesheets}\`;
                    const extendedCss = new ExtendedCss({
                        styleSheet: extendedCssContent,
                        beforeStyleApplied: (el) => {
                            return cssHitsCounter.countAffectedByExtendedCss(el);
                        }
                    });
                    extendedCss.apply();

                    console.debug('Extended css applied');
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
