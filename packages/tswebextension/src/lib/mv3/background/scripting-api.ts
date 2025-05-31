import { type ScriptletData } from '@adguard/tsurlfilter';
import { type Source } from '@adguard/scriptlets';

import { appContext } from './app-context';
import { type LocalScriptFunction } from './services/local-script-rules-service';
import { UserScriptsApi } from './user-scripts-api';

/**
 * Parameters for applying CSS rules.
 */
export type InsertCSSParams = {
    /**
     * The ID of the tab.
     */
    tabId: number;

    /**
     * The ID of the frame.
     */
    frameId: number;

    /**
     * The CSS text to be applied.
     */
    cssText: string;
};

type ExecuteTarget = {
    /**
     * The ID of the tab.
     */
    tabId: number;

    /**
     * The ID of the frame.
     */
    frameId: number;
};

/**
 * Parameters for executing script function.
 */
export type ExecuteScriptFuncParams = ExecuteTarget & {
    /**
     * The script function to be executed.
     */
    scriptFunction: LocalScriptFunction;
};

/**
 * Parameters for executing scriptlet.
 */
export type ExecuteScriptletParams = ExecuteTarget & {
    /**
     * The scriptlet data to be executed.
     */
    scriptletData: ScriptletData;

    /**
     * The domain name of the frame.
     */
    domainName: string | null;
};

/**
 * Parameters for executing script function or scriptlet.
 */
export type ExecuteCombinedScriptParams = ExecuteTarget & {
    /**
     * Combined script text to be injected.
     */
    scriptText: string;
};

/**
 * JavaScript rule execution in our extension follows a strict security model that fully
 * complies with Chrome Web Store policies:
 *
 * 1. For standard users (default mode):
 *    - We collect and pre-build script rules from the filters and statically bundle
 *      them into the extension - STEP 1. See 'updateLocalResourcesForChromiumMv3' in our build tools.
 *    - These pre-verified local scripts are passed to the engine - STEP 2.
 *    - At runtime, we check if each script rule is included in our local scripts list (STEP 3).
 *    - Only pre-verified local scripts are executed via chrome.scripting API (STEP 4.1 and 4.2).
 *      All other scripts are discarded.
 *
 * 2. For advanced users with developer mode explicitly enabled:
 *    - JavaScript rules from custom filters can be executed using the browser's built-in
 *      userScripts API (STEP 4.3), which provides a secure sandbox.
 *    - This execution bypasses the local script verification process but remains
 *      isolated and secure through Chrome's native sandboxing.
 *    - This mode requires explicit user activation and is intended for advanced users only.
 *
 * This dual-path implementation ensures perfect compliance with Chrome Web Store policies
 * while providing necessary functionality for users with different needs.
 */

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
     *
     * @returns Promise that resolves when the CSS is injected.
     */
    public static async insertCSS({
        tabId,
        frameId,
        cssText,
    }: InsertCSSParams): Promise<void> {
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
     *
     * @returns Promise that resolves when the script is executed.
     */
    public static async executeScriptlet({
        tabId,
        frameId,
        scriptletData,
        domainName,
    }: ExecuteScriptletParams): Promise<void> {
        const params: Source = {
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
        /**
         * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
         *
         * This is STEP 4.2: Apply JS functions from pre-built filters — via chrome.scripting API.
         */
        await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            func: scriptFunction,
            injectImmediately: true,
            world: 'MAIN',
        });
    }

    /**
     * Executes scripts or scriptlets within the scope of the page using
     * UserScripts API.
     *
     * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
     *
     * This is STEP 4.3: For developer mode only - JavaScript rules from custom filters:
     * - When developer mode is explicitly enabled, all JavaScript rules (including those from custom filters)
     *   are executed using the browser's built-in userScripts API.
     * - This execution path bypasses the local script verification but remains secure through
     *   Chrome's native sandbox isolation.
     *
     * @param params Parameters for executing the scripts or scriptlets.
     * @param params.tabId The ID of the tab.
     * @param params.frameId The ID of the frame.
     * @param params.scriptText Combined script text to be injected.
     *
     * @returns Promise that resolves when the scripts are executed.
     */
    public static async executeScriptsViaUserScripts({
        tabId,
        frameId,
        scriptText,
    }: ExecuteCombinedScriptParams): Promise<void> {
        await UserScriptsApi.executeScripts({
            tabId,
            frameId,
            scriptText,
        });
    }
}
