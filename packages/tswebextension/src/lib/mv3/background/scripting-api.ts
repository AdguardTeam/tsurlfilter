import browser from 'webextension-polyfill';
import { CosmeticOption, type ScriptletData } from '@adguard/tsurlfilter';
import { appContext } from './app-context';
import { logger } from '../../common';

/**
 *
 */
export class ScriptingApi {
    /**
     *
     * @param css
     * @param tabId
     * @param frameId
     */
    public static async insertCss(css: string, tabId: number, frameId: number): Promise<void> {
        try {
            await chrome.scripting.insertCSS({
                css,
                origin: 'USER',
                target: { tabId, frameIds: [frameId] },
            });
        } catch (e) {
            console.log(e);
        }
    }

    /**
     *
     * @param {...any} args
     * @param injection
     */
    public static async promisifiedExecuteScript(injection: chrome.scripting.ScriptInjection<any[], unknown>): Promise<any> {
        if (injection.target.tabId === -1) {
            return;
        }

        // eslint-disable-next-line consistent-return
        return new Promise((resolve, reject) => {
            chrome.scripting.executeScript(injection, (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result);
                }
            });
        });
    }

    /**
     * // FIXME make sure that it is not includes scriptlets.
     * @param scriptText
     * @param tabId
     * @param frameId
     */
    public static async executeScript(scriptText: string, tabId: number, frameId: number): Promise<void> {
        // FIXME use way without polluting global scope
        /**
         * We use changing variable name because global properties can be modified across isolated worlds of extension
         * content page and tab page.
         *
         * Issue: @see {@link https://bugs.chromium.org/p/project-zero/issues/detail?id=1225&desc=6}.
         */
        const variableName = `scriptExecuted${appContext.startTimeMs}`;

        /**
         * Executes scripts in a scope of the page, but the `window` fields are in
         * an isolated scope, e.g. `window.${variableName}` will only be visible in
         * this scope of the script, but not in the original scope of the page.
         * In order to prevent multiple script execution, the function checks if the script was already executed.
         *
         * Sometimes in Firefox, when content-filtering is applied to the page, a race condition happens.
         * This causes an issue when the page doesn't have its document.head or document.documentElement at the moment of
         * injection. So the script waits for them. But if the number of frame-requests reaches FRAME_REQUESTS_LIMIT,
         * the script stops waiting with an error.
         * Description of the issue: @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1004}.
         *
         * Injecting content-script, which appends a script tag, breaks Firefox's pretty printer for XML documents.
         * Description of the issue: @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2194}.
         *
         * CSP may prevent script execution in Firefox if script.textContent is used.
         * That's why script.src is used as a primary way, and script.textContent is used as a fallback.
         * Description of the issue: @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1733}.
         * @param scriptText
         * @param variableName
         */
        const functionToInject = (scriptText: string, variableName: string) => {
            // @ts-ignore
            if (window[variableName]) {
                return;
            }

            const injectViaScriptTag = (): void => {
                const scriptTag = document.createElement('script');
                scriptTag.setAttribute('type', 'text/javascript');
                scriptTag.textContent = scriptText;

                const parent = document.head || document.documentElement;
                parent.appendChild(scriptTag);

                if (scriptTag.parentNode) {
                    scriptTag.parentNode.removeChild(scriptTag);
                }
            };

            try {
                // eslint-disable-next-line no-eval
                eval(scriptText);
            } catch (e) {
                // if eval fails, inject via script tag
                injectViaScriptTag();
            }
        };

        await ScriptingApi.promisifiedExecuteScript({
            target: { tabId, frameIds: [frameId] },
            func: functionToInject,
            injectImmediately: true,
            world: 'MAIN', // ISOLATED doesn't allow to execute code inline
            args: [scriptText, variableName],
        });
    }

    /**
     * Executes scriptlets data via browser.scripting.executeScript api.
     *
     * @param tabId Tab id.
     * @param scriptletsData List of {@link ScriptletData}.
     * @param frameId
     */
    public static async executeScriptletsData(
        scriptletsData: ScriptletData[],
        tabId: number,
        frameId: number,
    ): Promise<void> {
        const promises = scriptletsData.map(async (scriptletData) => {
            // FIXME make scriptlets verbose
            // scriptletData.params.verbose = CosmeticJsApi.verbose;
            scriptletData.params.verbose = true;

            await ScriptingApi.promisifiedExecuteScript({
                target: { tabId, frameIds: [frameId] },
                func: scriptletData.func,
                injectImmediately: true,
                world: 'MAIN', // ISOLATED doesn't allow to execute code inline
                args: [scriptletData.params, scriptletData.params.args],
            });
        });

        await Promise.all(promises);
    }
}
