import { appContext } from './app-context';
import { type ApplyScriptRulesParams } from './cosmetic-api';

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
        await chrome.scripting.insertCSS({
            css,
            origin: 'USER',
            target: { tabId, frameIds: [frameId] },
        });
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
     * @param params
     */
    public static async executeScript(params: ApplyScriptRulesParams): Promise<void> {
        // FIXME figure out how to use way without polluting global scope
        /**
         * We use changing variable name because global properties can be modified across isolated worlds of extension
         * content page and tab page.
         *
         * Issue: @see {@link https://bugs.chromium.org/p/project-zero/issues/detail?id=1225&desc=6}.
         */
        const variableName = `scriptExecuted${appContext.startTimeMs}`;

        /**
         * Executes scripts in a scope of the page.
         * In order to prevent multiple script execution, the function checks if the script was already executed.
         *
         * @param scriptText Script text.
         * @param variableName Variable name to store the flag of script execution.
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

            // @ts-ignore
            window[variableName] = true;
        };

        const { tabId, frameId, scriptText } = params;

        await ScriptingApi.promisifiedExecuteScript({
            target: { tabId, frameIds: [frameId] },
            func: functionToInject,
            injectImmediately: true,
            world: 'MAIN', // ISOLATED doesn't allow to execute code inline
            args: [scriptText, variableName],
        });
    }
}
