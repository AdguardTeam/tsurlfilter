import { nanoid } from '../../common/utils/nanoid';

import { browserDetectorMV2 } from './utils/browser-detector';

/**
 * Taken from:
 * {@link https://github.com/seanl-adg/InlineResourceLiteral/blob/master/index.js#L136} and
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
 * Builds script to inject in a safe way for Firefox.
 *
 * @param scriptText Script text to execute.
 * @param variableName Variable name to check if script was executed.
 *
 * @returns Wrapped script text to inject on the page.
 */
const buildScriptTextForFirefox = (scriptText: string, variableName: string): string => {
    /**
     * Unique guard ID to check if a script was executed at the first attempt.
     *
     * `window.wrappedJSObject` is available only in Firefox
     * and it provides access to the page's window object context from the content script.
     * It is used to check whether the first script injection attempt was successful.
     * So if the script was not executed, tries to use `script.src + blob`
     * as a workaround for {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1733 | CSP issue}.
     *
     * @see {@link https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts}
     */
    const guardId = nanoid();

    const scriptWithGuard = `window['${guardId}'] = true;\n${scriptText}`;

    const preparedScriptText = `${scriptWithGuard.replace(reJsEscape, escapeJs)}`;

    return `(function() {\
        if (window.${variableName} || document instanceof XMLDocument) {\
            return;\
        }\
        var script;\
        var blob;\
        var url;\
        var FRAME_REQUESTS_LIMIT = 500;\
        var frameRequests = 0;\
        function waitParent () {\
            frameRequests += 1;\
            var parent = document.head || document.documentElement;\
            if (!parent) {\
                return;\
            }\
            try {\
                script = document.createElement("script");\
                var textNode = document.createTextNode("${preparedScriptText}");\
                script.appendChild(textNode);\
                parent.appendChild(script);\
            } catch (e) {\
            }\
            if (script) {\
                script.remove();\
            }\
            if (window.wrappedJSObject["${guardId}"]) {\
                delete window.wrappedJSObject["${guardId}"];\
                window.${variableName} = true;\
                return true;\
            }
            try {\
                script = document.createElement("script");\
                blob = new Blob(["${preparedScriptText}"], { type: "text/javascript; charset=utf-8" });\
                url = URL.createObjectURL(blob);\
                script.async = false;\
                script.src = url;\
                parent.appendChild(script);\
            } catch (e) {\
                script.setAttribute("type", "text/javascript");\
                script.textContent = "${preparedScriptText}";\
            }\
            if (script) {\
                if (url) {\
                    URL.revokeObjectURL(url);\
                }\
                script.remove();\
                window.${variableName} = true;\
                return true;\
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

/**
 * Builds script to inject in a safe way for browsers other than Firefox.
 *
 * @param scriptText Script text to execute.
 * @param variableName Variable name to check if script was executed.
 *
 * @returns Wrapped script text to inject on the page.
 */
const buildScriptTextCommon = (scriptText: string, variableName: string): string => {
    const preparedScriptText = scriptText.replace(reJsEscape, escapeJs);

    return `(function() {\
        if (window.${variableName} || document instanceof XMLDocument) {\
            return;\
        }\
        var script = document.createElement("script");\
        var blob;\
        var url;\
        try {\
            var textNode = document.createTextNode("${preparedScriptText}");\
            script.appendChild(textNode);\
        } catch (e) {\
            script.setAttribute("type", "text/javascript");\
            script.textContent = "${preparedScriptText}";\
        }\
        var FRAME_REQUESTS_LIMIT = 500;\
        var frameRequests = 0;\
        function waitParent () {\
            frameRequests += 1;\
            var parent = document.head || document.documentElement;\
            if (!parent) {\
                return;\
            }\
            try {\
                parent.appendChild(script);\
                if (url) {\
                    URL.revokeObjectURL(url);\
                }\
                script.remove();\
            } catch (e) {\
            } finally {\
                window.${variableName} = true;\
                return true;\
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

/**
 * Builds script to inject in a safe way.
 *
 * @see {@link LocalScriptRulesService} for details about script source.
 *
 * @param scriptText Script text.
 * @param startTimeMs App start time in milliseconds.
 *
 * @returns Script to inject.
 *
 * @throws Error if start time is not defined.
 */
export const buildScriptText = (scriptText: string, startTimeMs: number | undefined): string => {
    if (!startTimeMs) {
        throw new Error('Start time is not defined');
    }

    /**
     * We use changing variable name because global properties can be modified across isolated worlds of extension
     * content page and tab page.
     *
     * Issue: @see {@link https://bugs.chromium.org/p/project-zero/issues/detail?id=1225&desc=6}.
     */
    const variableName = `scriptExecuted${startTimeMs}`;

    const isFirefox = browserDetectorMV2.isFirefox();

    /**
     * Executes scripts in a scope of the page, but the `window` fields are in
     * an isolated scope, e.g. `window.${variableName}` will only be visible in
     * this scope of the script, but not in the original scope of the page.
     * In order to prevent multiple script execution checks if script was already executed.
     *
     * Sometimes in Firefox when content-filtering is applied to the page race condition happens.
     * This causes an issue when the page doesn't have its document.head or document.documentElement at the moment of
     * injection. So script waits for them. But if a quantity of frame-requests reaches FRAME_REQUESTS_LIMIT then
     * script stops waiting with the error.
     * Description of the issue: @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1004}.
     *
     * Injecting content-script, which appends a script tag, breaks Firefox's pretty printer for xml documents.
     * Description of the issue: @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2194}.
     *
     * IMPORTANT: Injecting script via a text node or textContent property is crucial for the injection speed.
     * That's why it should be used as a primary way.
     *
     * CSP may prevent script execution in Firefox but script.src + blob is a workaround for this issue.
     * Description of the issue: @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1733}.
     * So for Firefox:
     * 1) text node as a script child is used as a primary way,
     * 2) script.src + blob is used as a secondary way,
     * 3) script.textContent is used as a final fallback.
     *
     * There is no such CSP issue in Chromium, so for Chromium:
     * 1) text node as a script child is a primary way,
     * 2) script.textContent is used as a fallback.
     */
    return isFirefox
        ? buildScriptTextForFirefox(scriptText, variableName)
        : buildScriptTextCommon(scriptText, variableName);
};
