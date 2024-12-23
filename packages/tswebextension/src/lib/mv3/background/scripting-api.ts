import { type ScriptletData } from '@adguard/tsurlfilter';
import { type IConfiguration } from '@adguard/scriptlets';

import { appContext } from './app-context';
import { BACKGROUND_TAB_ID } from '../../common/constants';
import { type LocalScriptFunction } from './services/local-script-rules-service';

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
 * Parameters for executing script function.
 */
export type ExecuteScriptFuncParams = {
    /**
     * The ID of the tab.
     */
    tabId: number,

    /**
     * The ID of the frame.
     */
    frameId: number,

    /**
     * The script function to be executed.
     */
    scriptFunction: LocalScriptFunction,
};

/**
 * Parameters for executing script function.
 */
export type ExecuteScriptTextParams = {
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
     * @param params.scriptFunction The script function to be executed.
     *
     * @returns Promise that resolves when the script is executed.
     */
    public static async executeScriptFunc({
        tabId,
        frameId,
        scriptFunction,
    }: ExecuteScriptFuncParams): Promise<void> {
        // There is no reason to inject a script into the background page
        if (tabId === BACKGROUND_TAB_ID) {
            return;
        }

        /**
         * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
         *
         * This is STEP 4.1: Apply JS rules from pre-built filters — via chrome.scripting API.
         */
        await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            func: scriptFunction,
            injectImmediately: true,
            world: 'MAIN',
        });
    }

    /**
     * Executes a script within the scope of the page.
     *
     * @param params Parameters for executing the script.
     * @param params.tabId The ID of the tab.
     * @param params.frameId The ID of the frame.
     * @param params.scriptText The script content to be executed.
     *
     * @returns Promise that resolves when the script is executed.
     */
    public static async executeScriptText({
        tabId,
        frameId,
        scriptText,
    }: ExecuteScriptTextParams): Promise<void> {
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

            /**
             * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
             *
             * This is STEP 4.2: Apply JS rules manually added by users — via script tag injection.
             */
            injectViaScriptTag(scriptTextWithPolicy);

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
            }],
        });
    }
}
