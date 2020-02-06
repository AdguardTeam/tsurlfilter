/* eslint-disable no-undef */
/**
 * Preload content script
 */
(() => {
    /**
     * Execute scripts in a page context and cleanup itself when execution completes
     * @param {string} script Script to execute
     */
    const executeScript = (script) => {
        const scriptTag = document.createElement('script');
        scriptTag.setAttribute('type', 'text/javascript');
        scriptTag.textContent = script;

        const parent = document.head || document.documentElement;
        parent.appendChild(scriptTag);
        if (scriptTag.parentNode) {
            scriptTag.parentNode.removeChild(scriptTag);
        }
    };

    /**
     * Applies JS injections.
     * @param scripts Array with JS scripts and scriptSource ('remote' or 'local')
     */
    const applyScripts = (scripts) => {
        if (!scripts || scripts.length === 0) {
            return;
        }

        const scriptsCode = scripts.join('\r\n');

        const toExecute = `
            (function () {
                try {
                    ${scriptsCode}
                } catch (ex) {
                    console.error('Error executing AG js: ' + ex);
                }
            })();
            `;

        /**
         * JS injections are created by JS filtering rules:
         * http://adguard.com/en/filterrules.html#javascriptInjection
         */
        executeScript(toExecute);
    };

    /**
     * Applies CSS stylesheets
     *
     * @param css Array with CSS stylesheets
     */
    const applyCss = (css) => {
        if (!css || css.length === 0) {
            return;
        }

        for (let i = 0; i < css.length; i += 1) {
            const styleEl = document.createElement('style');
            styleEl.setAttribute('type', 'text/css');
            styleEl.textContent = css[i];

            (document.head || document.documentElement).appendChild(styleEl);
        }
    };

    /**
     * Applies Extended Css stylesheet
     *
     * @param extendedCss Array with ExtendedCss stylesheets
     */
    const applyExtendedCss = (extendedCss) => {
        // TODO: Apply extended css

        if (!extendedCss || !extendedCss.length) {

        }
        //
        // window.extcss = new ExtendedCss({
        //     styleSheet: extendedCss.join('\n'),
        //     beforeStyleApplied: CssHitsCounter.countAffectedByExtendedCss,
        // });
        // extcss.apply();
    };

    /**
     * Applies CSS and extended CSS stylesheets
     * @param selectors     Object with the stylesheets got from the background page.
     */
    const applySelectors = (selectors) => {
        if (!selectors) {
            return;
        }

        applyCss(selectors.css);
        applyExtendedCss(selectors.extendedCss);
    };

    /**
     * Processes response from the background page containing CSS and JS injections
     * @param response Response from the background page
     */
    const processCssAndScriptsResponse = (response) => {
        console.debug('Applying css and scripts..');
        console.debug(response);

        applySelectors(response.selectors);
        applyScripts(response.scripts);
    };

    /**
     * Loads CSS and JS injections
     */
    const tryLoadCssAndScripts = () => {
        const message = {
            type: 'getSelectorsAndScripts',
            // eslint-disable-next-line no-undef
            documentUrl: window.location.href,
        };

        /**
         * Sending message to background page and passing a callback function
         */
        chrome.runtime.sendMessage(message, processCssAndScriptsResponse);
    };

    /**
     * Checks if it is html document
     *
     * @returns {boolean}
     */
    // eslint-disable-next-line no-undef
    const isHtml = () => document instanceof HTMLDocument;

    const init = () => {
        if (!isHtml()) {
            return;
        }

        tryLoadCssAndScripts();
    };

    init();
})();
