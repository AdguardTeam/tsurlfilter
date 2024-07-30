import { appContext } from './app-context';
import { BACKGROUND_TAB_ID } from '../../common/constants';

/**
 * Parameters for applying CSS rules.
 */
export type InsertCSSParams = {
    tabId: number,
    frameId: number,
    cssText: string,
};

/**
 * Parameters for executing script.
 */
export type ExecuteScriptParams = {
    tabId: number,
    frameId: number,
    scriptText: string,
};

/**
 * This class is wrapping around chrome.scripting API.
 */
export class ScriptingApi {
    /**
     * Injects CSS into a tab.
     *
     * @param params Parameters for applying CSS rules.
     * @param params.tabId Tab id.
     * @param params.frameId Frame id.
     * @param params.cssText CSS text.
     * @returns Promise that resolves when the CSS is injected.
     */
    public static async insertCSS({ tabId, frameId, cssText }: InsertCSSParams): Promise<void> {
        if (tabId === BACKGROUND_TAB_ID) {
            return;
        }

        await chrome.scripting.insertCSS({
            css: cssText,
            origin: 'USER',
            target: { tabId, frameIds: [frameId] },
        });
    }

    /**
     * Executes a script in the scope of the page.
     *
     * @param params Parameters for executing a script.
     * @param params.tabId Tab id.
     * @param params.frameId Frame id.
     * @param params.scriptText Script text.
     * @returns Promise that resolves when the script is executed.
     */
    public static async executeScript({ tabId, frameId, scriptText }: ExecuteScriptParams): Promise<void> {
        // There is no sense to inject a script into the background page
        if (tabId === BACKGROUND_TAB_ID) {
            return;
        }

        /**
         * Executes scripts in the scope of the page.
         * To prevent multiple script execution, the function checks if the script was already executed.
         *
         * @param scriptText Script text.
         * @param executedFlag Flag to check if the script was already executed.
         */
        // eslint-disable-next-line @typescript-eslint/no-shadow
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
