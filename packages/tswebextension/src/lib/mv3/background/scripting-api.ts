import { appContext } from './app-context';
import { BACKGROUND_TAB_ID } from '../../common/constants';

/**
 * Trusted Types API used to describe to appease the type checker.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/TrustedTypePolicy.
 */
declare const trustedTypes: {
    createPolicy(name: string, policyOptions: {
        createHTML?: (input: string) => string;
        createScript?: (input: string) => string;
        createScriptURL?: (input: string) => string;
    }): {
        createHTML: (input: string) => string;
        createScript: (input: string) => string;
        createScriptURL: (input: string) => string;
    };
};

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

            /**
             * Keep constant here.
             * Otherwise, it won't be available in the function from the outside.
             */
            const AG_POLICY_NAME = 'AGPolicy';

            const AGPolicy = {
                createHTML: (input: string) => input,
                createScript: (input: string) => input,
                createScriptURL: (input: string) => input,
            };

            let policy = AGPolicy;

            if (trustedTypes) {
                policy = trustedTypes.createPolicy(AG_POLICY_NAME, AGPolicy);
            }

            // eslint-disable-next-line @typescript-eslint/no-shadow
            const injectViaScriptTag = (scriptText: string): void => {
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
                eval(policy.createScript(scriptText));
            } catch (e) {
                // if eval fails, inject via script tag
                injectViaScriptTag(policy.createScript(scriptText));
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
