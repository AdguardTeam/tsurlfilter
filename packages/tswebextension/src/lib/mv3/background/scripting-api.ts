import { type ScriptletData } from '@adguard/tsurlfilter';
import { type IConfiguration } from '@adguard/scriptlets';

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
 * Whether to use a blob to inject the script.
 */
const USE_BLOB_DEFAULT = false;

/**
 * Parameters for executing script.
 */
export type ExecuteScriptParams = {
    /**
     * The ID of the tab.
     */
    tabId: number,

    /**
     * The ID of the frame.
     */
    frameId: number,

    /**
     * The script content to be executed.
     */
    scriptText: string,

    /**
     * Whether to use a blob to inject the script.
     * By default, it is set to {@link USE_BLOB_DEFAULT}.
     */
    useBlob?: boolean,
};

/**
 * Parameters for executing scriptlet.
 */
export type ExecuteScriptletParams = {
    /**
     * The ID of the tab.
     */
    tabId: number,

    /**
     * The ID of the frame.
     */
    frameId: number,

    /**
     * The scriptlet data to be executed.
     */
    scriptletData: ScriptletData,

    /**
     * The domain name of the frame.
     */
    domainName: string | null,
};

/**
 * Parameters for injecting the script.
 */
type InjectFuncOptions = {
    /**
     * Unique identifier for the script.
     * It is used to prevent multiple executions of the same script on the page.
     */
    uniqueIdentifier: string,

    /**
     * Whether to use a blob to inject the script.
     * Used in rare cases when inline scripts are not allowed by the CSP policy.
     * For example, on Facebook.
     */
    useBlob: boolean,
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
     * Executes a scriptlet within the scope of the page.
     *
     * @param params Parameters for executing the scriptlet.
     * @param params.tabId The ID of the tab.
     * @param params.frameId The ID of the frame.
     * @param params.scriptletData The scriptlet data to be executed.
     * @param params.domainName The domain name of the frame. Used for debugging.
     * @returns Promise that resolves when the script is executed.
     */
    public static async executeScriptlet(
        {
            tabId,
            frameId,
            scriptletData,
            domainName,
        }: ExecuteScriptletParams,
    ): Promise<void> {
        // There is no reason to inject a script into the background page
        if (tabId === BACKGROUND_TAB_ID) {
            return;
        }

        const params: IConfiguration = {
            ...scriptletData.params,
            uniqueId: String(appContext.startTimeMs),
            verbose: appContext.configuration?.settings.debugScriptlets || false,
            domainName: domainName ?? undefined,
        };

        await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            func: scriptletData.func,
            injectImmediately: true,
            world: 'MAIN',
            args: [params, scriptletData.params.args],
        });
    }

    /**
     * Executes a script within the scope of the page.
     *
     * @param params Parameters for executing the script.
     * @param params.tabId The ID of the tab.
     * @param params.frameId The ID of the frame.
     * @param params.scriptText The script content to be executed.
     * @param params.useBlob Whether to use a blob to inject the script.
     * @returns Promise that resolves when the script is executed.
     */
    public static async executeScript({
        tabId,
        frameId,
        scriptText,
        useBlob = USE_BLOB_DEFAULT,
    }: ExecuteScriptParams): Promise<void> {
        // There is no reason to inject a script into the background page
        if (tabId === BACKGROUND_TAB_ID) {
            return;
        }

        /**
         * Executes the script within the scope of the page.
         * To prevent multiple executions, this function checks if the script has already been executed.
         *
         * @param scriptText The script content to be executed.
         * @param options Options for the inject function {@link InjectFuncOptions}.
         */
        function injectFunc(
            // eslint-disable-next-line @typescript-eslint/no-shadow
            scriptText: string,
            options: InjectFuncOptions,
        ): void {
            const flag = 'done';

            // Do not care about types here
            // @ts-ignore
            if (Window.prototype.toString[options.uniqueIdentifier] === flag) {
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

            /**
             * Injects the script into the page using a blob.
             * This method is used when inline scripts are not allowed by the CSP policy.
             * We use it only in rare cases since it is not so fast as the injecting via script tag with textContent.
             * @param scriptText The script content to be executed.
             */
            // eslint-disable-next-line @typescript-eslint/no-shadow
            const injectViaScriptTagWithBlob = (scriptText: string): void => {
                const scriptTag = document.createElement('script');

                const blob = new Blob([scriptText], { type: 'text/javascript; charset=utf-8' });
                const url = URL.createObjectURL(blob);
                scriptTag.src = policy.createScriptURL(url);

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
            };

            /**
             * Injects the script into the page using a script tag.
             * @param scriptText The script content to be executed.
             */
            // eslint-disable-next-line @typescript-eslint/no-shadow
            const injectViaScriptTag = (scriptText: string): void => {
                const scriptTag = document.createElement('script');

                scriptTag.setAttribute('type', 'text/javascript');
                scriptTag.textContent = scriptText;

                const parent = document.head || document.documentElement;
                if (parent) {
                    parent.appendChild(scriptTag);
                }

                if (scriptTag.parentNode) {
                    scriptTag.parentNode.removeChild(scriptTag);
                }

                if (scriptTag) {
                    scriptTag.textContent = policy.createScript('');
                }
            };

            const scriptTextWithPolicy = policy.createScript(scriptText);
            if (options.useBlob) {
                injectViaScriptTagWithBlob(scriptTextWithPolicy);
            } else {
                injectViaScriptTag(scriptTextWithPolicy);
            }

            Object.defineProperty(Window.prototype.toString, options.uniqueIdentifier, {
                value: flag,
                enumerable: false,
                writable: false,
                configurable: false,
            });
        }

        const uniqueIdentifier = `AG_done_${appContext.startTimeMs}`;

        await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            func: injectFunc,
            injectImmediately: true,
            world: 'MAIN', // ISOLATED doesn't allow to execute code inline
            args: [scriptText, {
                uniqueIdentifier,
                useBlob,
            }],
        });
    }
}
