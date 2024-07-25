/* eslint-disable @typescript-eslint/no-shadow */
import { appContext } from './app-context';
import { type ExecuteScriptParams } from './cosmetic-api';
import { BACKGROUND_TAB_ID } from '../../common/constants';

/**
 * This class is wrapping around chrome.scripting API.
 */
export class ScriptingApi {
    /**
     * Injects CSS into a tab.
     * @param css CSS to inject.
     * @param tabId Tab id.
     * @param frameId Frame id.
     */
    public static async insertCss(css: string, tabId: number, frameId: number): Promise<void> {
        if (tabId === BACKGROUND_TAB_ID) {
            return;
        }

        await chrome.scripting.insertCSS({
            css,
            origin: 'USER',
            target: { tabId, frameIds: [frameId] },
        });
    }

    /**
     * Executes script in a scope of the page.
     * @param params Parameters.
     */
    public static async executeScript(params: ExecuteScriptParams): Promise<void> {
        const { tabId, frameId, scriptText } = params;

        // There is no sense to inject script into background page
        if (tabId === BACKGROUND_TAB_ID) {
            return;
        }

        /**
         * Executes scripts in a scope of the page.
         * In order to prevent multiple script execution, the function checks if the script was already executed.
         *
         * @param scriptText Script text.
         * @param executedFlag Flag to check if the script was already executed.
         */
        function injectFunc(scriptText: string, executedFlag: string): void {
            // We don't care about types here
            // @ts-ignore
            if (window[executedFlag]) {
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

            // We don't care about types here
            // @ts-ignore
            window[executedFlag] = true;
        }

        // TODO figure out how to avoid double injection without polluting global scope
        const executedFlag = `executed${appContext.startTimeMs}`;

        await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            func: injectFunc,
            injectImmediately: true,
            world: 'MAIN', // ISOLATED doesn't allow to execute code inline
            args: [scriptText, executedFlag],
        });
    }
}
