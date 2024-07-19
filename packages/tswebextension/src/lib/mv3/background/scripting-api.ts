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
     */
    public static async promisifiedExecuteScript(injection: chrome.scripting.ScriptInjection<any[], unknown>): Promise<any> {
        return new Promise((resolve, reject) => {
            console.trace('to see from which was executed');
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
     *
     * @param scriptText
     * @param tabId
     * @param frameId
     */
    public static async executeScript(scriptText: string, tabId: number, frameId: number): Promise<void> {
        // const functionToInject = (script: string): void => {
        //     const scriptTag = document.createElement('script');
        //     scriptTag.setAttribute('type', 'text/javascript');
        //     scriptTag.textContent = script;
        //
        //     const parent = document.head || document.documentElement;
        //     parent.appendChild(scriptTag);
        //
        //     if (scriptTag.parentNode) {
        //         scriptTag.parentNode.removeChild(scriptTag);
        //     }
        // };

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
            // FIXME check if possible to do anything with the variable
            // @ts-ignore
            if (window[variableName] || document instanceof XMLDocument) {
                return;
            }
            const script = document.createElement('script');
            const preparedScriptText = scriptText;
            let blob;
            let url: string;
            try {
                blob = new Blob([preparedScriptText], { type: 'text/javascript; charset=utf-8' });
                url = URL.createObjectURL(blob);
                script.src = url;
            } catch (e) {
                script.setAttribute('type', 'text/javascript');
                script.textContent = preparedScriptText;
            }
            const FRAME_REQUESTS_LIMIT = 500;
            let frameRequests = 0;

            /**
             *
             */
            function waitParent() {
                frameRequests += 1;
                const parent = document.head || document.documentElement;
                if (parent) {
                    let scriptInjected = false;
                    try {
                        parent.appendChild(script);
                        if (url) {
                            URL.revokeObjectURL(url);
                        }
                        parent.removeChild(script);
                        scriptInjected = true;
                    } catch (e) {
                        console.error('AdGuard: Error appending/removing script', e);
                        // do nothing
                    } finally {
                        // FIXME check if possible to do anything with the variable
                        // @ts-ignore
                        window[variableName] = true;
                    }
                    return scriptInjected;
                }
                if (frameRequests < FRAME_REQUESTS_LIMIT) {
                    requestAnimationFrame(waitParent);
                } else {
                    console.log('AdGuard: document.head or document.documentElement were unavailable too long');
                }
            }
            waitParent();
        };

        function fn() {
            console.log('hello from max');
        }

        await ScriptingApi.promisifiedExecuteScript({
            target: { tabId, frameIds: [frameId] },
            func: fn,
            injectImmediately: true,
            world: 'MAIN', // ISOLATED doesn't allow to execute code inline
            args: [],
        });

        // FIXME prepare script text
        // scriptText.replace(reJsEscape, escapeJs)
        try {
            await ScriptingApi.promisifiedExecuteScript({
                target: { tabId, frameIds: [frameId] },
                func: functionToInject,
                injectImmediately: true,
                world: 'MAIN', // ISOLATED doesn't allow to execute code inline
                args: [scriptText, variableName],
            });
        } catch (e) {
            logger.debug(
                `[tswebextension.executeScript]: Error on executeScript in the tab: ${tabId}, frame: ${frameId}`,
                browser.runtime.lastError,
                e,
            );
        }
    }

    /**
     * Executes scriptlets data via browser.scripting.executeScript api.
     *
     * @param tabId Tab id.
     * @param scriptletsData List of {@link ScriptletData}.
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

            try {
                await ScriptingApi.promisifiedExecuteScript({
                    target: { tabId, frameIds: [frameId] },
                    func: scriptletData.func,
                    injectImmediately: true,
                    world: 'MAIN', // ISOLATED doesn't allow to execute code inline
                    args: [scriptletData.params, scriptletData.params.args],
                });
            } catch (e) {
                logger.debug(
                    `[tswebextension.executeScriptletsData]: Error on executeScriptlet in the tab ${tabId}:`,
                    browser.runtime.lastError,
                    e,
                );
            }
        });

        await Promise.all(promises);
    }
}
