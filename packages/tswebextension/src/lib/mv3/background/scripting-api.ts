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
     * Executes a script within the scope of the page.
     *
     * @param params Parameters for executing the script.
     * @param params.tabId The ID of the tab.
     * @param params.frameId The ID of the frame.
     * @param params.scriptText The script content to be executed.
     * @returns Promise that resolves when the script is executed.
     */
    public static async executeScript({ tabId, frameId, scriptText }: ExecuteScriptParams): Promise<void> {
        // There is no reason to inject a script into the background page
        if (tabId === BACKGROUND_TAB_ID) {
            return;
        }

        /**
         * Executes the script within the scope of the page.
         * To prevent multiple executions, this function checks if the script has already been executed.
         *
         * @param scriptText The script content to be executed.
         * @param executedFlag A flag to check if the script has already been executed.
         */
        // eslint-disable-next-line @typescript-eslint/no-shadow
        function injectFunc(scriptText: string, executedFlag: string): void {
            // We don't care about types here
            // @ts-ignore
            if (window[executedFlag]) {
                return;
            }

            /**
             * Keep this constant here.
             * Otherwise, it won't be accessible from within the function.
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

                let blob;
                let url;
                try {
                    // This method is used to inject the script if inline scripts are not allowed by the CSP policy.
                    // It is attempted first because it will throw an error if it fails.
                    blob = new Blob([scriptText], { type: 'text/javascript; charset=utf-8' });
                    url = URL.createObjectURL(blob);
                    scriptTag.src = policy.createScriptURL(url);
                } catch (e) {
                    // This method does not throw an error in case of CSP policy restrictions,
                    // which is why it is used in the catch block.
                    scriptTag.setAttribute('type', 'text/javascript');
                    scriptTag.appendChild(document.createTextNode(scriptText));
                }

                const parent = document.head || document.documentElement;
                if (parent) {
                    parent.appendChild(scriptTag);
                }

                if (url) {
                    URL.revokeObjectURL(url);
                }

                if (scriptTag.parentNode) {
                    scriptTag.parentNode.removeChild(scriptTag);
                }

                if (scriptTag) {
                    scriptTag.textContent = policy.createScript('');
                }
            };

            const scriptTextWithPolicy = policy.createScript(scriptText);
            try {
                // eslint-disable-next-line no-eval
                eval(scriptTextWithPolicy);
            } catch (e) {
                injectViaScriptTag(scriptTextWithPolicy);
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
