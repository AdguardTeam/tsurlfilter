/* eslint-disable no-console, no-undef, import/extensions */
import { buildScriptText } from './injection-helper.js';

/**
 * Applies scripts from cosmetic result
 *
 * @param tabId
 * @param cosmeticResult
 */
export const applyScripts = (tabId, cosmeticResult) => {
    const scripts = [...cosmeticResult.JS.generic, ...cosmeticResult.JS.specific];
    if (scripts.length === 0) {
        return;
    }

    const scriptsCode = scripts.join('\r\n');
    const toExecute = buildScriptText(scriptsCode);

    chrome.tabs.executeScript(tabId, {
        code: toExecute,
    });
};

/**
 * Applies css from cosmetic result
 *
 * @param tabId
 * @param cosmeticResult
 */
export const applyCss = (tabId, cosmeticResult) => {
    const css = [...cosmeticResult.elementHiding.generic, ...cosmeticResult.elementHiding.specific]
        .map((selector) => `${selector} { display: none!important; }`);

    const extendedCssStylesheets = [
        ...cosmeticResult.elementHiding.genericExtCss,
        ...cosmeticResult.elementHiding.specificExtCss,
    ]
        .map(((selector) => `${selector} { display: none!important}`))
        .join('\n');

    // Apply extended css stylesheets
    chrome.tabs.executeScript(tabId, {
        code: `
                (() => {
                    const { ExtendedCss } = AGUrlFilter;
                    const extendedCssContent = \`${extendedCssStylesheets}\`;
                    const extendedCss = new ExtendedCss({styleSheet: extendedCssContent});
                    extendedCss.apply();
                })();
            `,
    });

    const styleText = css.join('\n');
    const injectDetails = {
        code: styleText,
        runAt: 'document_start',
    };

    chrome.tabs.insertCSS(tabId, injectDetails);
};
