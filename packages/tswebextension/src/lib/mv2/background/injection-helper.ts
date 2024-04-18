/**
 * Taken from:
 * {@link https://github.com/seanl-adg/InlineResourceLiteral/blob/master/index.js#L136}
 * {@link https://github.com/joliss/js-string-escape/blob/master/index.js}.
 */
const reJsEscape = /["'\\\n\r\u2028\u2029]/g;

const escapeJs = (match: string): string => {
    switch (match) {
        case '"':
        case "'":
        case '\\':
            return `\\${match}`;
        case '\n':
            /**
             * Line continuation character for ease of reading inlined resource.
             */
            return '\\n\\\n';
        case '\r':
            /**
             * Carriage returns won't have any semantic meaning in JS.
             */
            return '';
        case '\u2028':
            return '\\u2028';
        case '\u2029':
            return '\\u2029';
        default:
            return match;
    }
};

/**
 * We use changing variable name because global properties can be modified across isolated worlds of extension
 * content page and tab page.
 *
 * Issue: @see {@link https://bugs.chromium.org/p/project-zero/issues/detail?id=1225&desc=6}.
 */
const variableName = `scriptExecuted${Date.now()}`;

/**
 * Builds script to inject in a safe way.
 *
 * @see {@link LocalScriptRulesService} for details about script source.
 * @param scriptText Script text.
 * @returns Script to inject.
 */
export const buildScriptText = (scriptText: string): string => {
    /**
     * Executes scripts in a scope of the page, but the `window` fields are in
     * an isolated scope, e.g. `window.${variableName}` will only be visible in
     * this scope of the script, but not in the original scope of the page.
     * In order to prevent multiple script execution checks if script was already executed.
     * Sometimes in Firefox when content-filtering is applied to the page race condition happens.
     * This causes an issue when the page doesn't have its document.head or document.documentElement at the moment of
     * injection. So script waits for them. But if a quantity of frame-requests reaches FRAME_REQUESTS_LIMIT then
     * script stops waiting with the error.
     * Description of the issue: @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1004}.
     *
     * CSP may prevent script execution in Firefox if script.textContent is used.
     * That's why script.src is used as a primary way, and script.textContent is used as a fallback.
     * @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1733}.
     */
    return `(function() {\
                if (window.${variableName}) {\
                    return;\
                }\
                var script = document.createElement("script");\
                var preparedScriptText = "${scriptText.replace(reJsEscape, escapeJs)}";\
                var blob;\
                var url;\
                try {\
                    blob = new Blob([preparedScriptText], { type: "text/javascript; charset=utf-8" });\
                    url = URL.createObjectURL(blob);\
                    script.src = url;\
                } catch (e) {\
                    script.setAttribute("type", "text/javascript");\
                    script.textContent = preparedScriptText;\
                }\
                var FRAME_REQUESTS_LIMIT = 500;\
                var frameRequests = 0;\
                function waitParent () {\
                    frameRequests += 1;\
                    var parent = document.head || document.documentElement;\
                    if (parent) {\
                        try {\
                            parent.appendChild(script);\
                            if (url) {\
                                URL.revokeObjectURL(url);\
                            }\
                            parent.removeChild(script);\
                        } catch (e) {\
                        } finally {\
                            window.${variableName} = true;\
                            return true;\
                        }\
                    }\
                    if(frameRequests < FRAME_REQUESTS_LIMIT) {\
                        requestAnimationFrame(waitParent);\
                    } else {\
                        console.log("AdGuard: document.head or document.documentElement were unavailable too long");\
                    }\
                }\
                waitParent();\
            })()`;
};

// TODO: TSUrlFilterContentScript has been removed from tsurlfilter bundle
/**
 * Builds script to be injected into the page and applying extended css rules.
 *
 * @param extendedCssRules Array of extended css rules.
 * @returns Script to inject.
 */
export const buildExtendedCssScriptText = (extendedCssRules: string[]): string => {
    // extended css rules is array
    // so it should be injected into built script string as stringified array
    const injectedExtCssRules = JSON.stringify(extendedCssRules);
    return `(function() {
                // Init css hits counter
                const cssHitsCounter = new CssHitsCounter((stats) => {
                    console.debug('Css stats ready');
                    console.debug(stats);

                    chrome.runtime.sendMessage({type: "saveCssHitStats", stats: JSON.stringify(stats)});
                });

                // Apply extended css rules
                const cssRules = ${injectedExtCssRules};
                const extendedCss = new ExtendedCss({
                    cssRules,
                    beforeStyleApplied: (el) => {
                        return cssHitsCounter.countAffectedByExtendedCss(el);
                    }
                });
                extendedCss.apply();
            })()`;
};
