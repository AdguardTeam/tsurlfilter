import { type Source } from '@adguard/scriptlets';
import { type ScriptletData } from '@adguard/tsurlfilter';

import { appContext } from './app-context';
import { applyExtCss } from './extcss-apply-fn';
import { type LocalScriptFunction } from './services/local-script-rules-service';

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

    /**
     * Optional arguments to pass to the script function.
     */
    args?: unknown[];

    /**
     * The execution world for the script. Defaults to `'MAIN'`.
     */
    world?: 'MAIN' | 'ISOLATED';
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
 * Parameters for executing the ExtendedCSS engine + rules.
 */
export type ExecuteExtCssParams = ExecuteTarget & {
    /**
     * ExtendedCSS rule strings to apply.
     */
    cssRules: string[];

    /**
     * Whether to register the CSS-hits `beforeStyleApplied` callback in the
     * injected func.
     */
    collectStats: boolean;
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

        /**
         * This is STEP 4.2: Apply Scriptlet functions from pre-built filters — via chrome.scripting API.
         *
         * The whole process is explained below.
         *
         * To fully comply with Chrome Web Store policies regarding remote code execution,
         * we implement a strict security-focused approach for Scriptlet and JavaScript rules execution.
         *
         * 1. Default - regular users that did not grant User scripts API permission explicitly:
         *    - We collect and pre-build script rules from the filters and statically bundle
         *      them into the extension - STEP 1. See 'updateLocalResourcesForMv3' in our build tools.
         *      IMPORTANT: all scripts and their arguments are local and bundled within the extension.
         *    - These pre-verified local scripts are passed to the engine - STEP 2.
         *    - At runtime before the execution, we check if each script rule is included
         *      in our local scripts list (STEP 3).
         *    - Only pre-verified local scripts are executed via chrome.scripting API (STEP 4.1 and 4.2).
         *      All other scripts are discarded.
         *    - Custom filters are NOT allowed for regular users to prevent any possibility
         *      of remote code execution, regardless of rule interpretation.
         *
         * 2. For advanced users that explicitly granted User scripts API permission -
         *    via enabling the Developer mode or Allow user scripts in the extension details:
         *    - Custom filters are allowed and may contain Scriptlet and JS rules
         *      that can be executed using the browser's built-in userScripts API (STEP 4.3),
         *      which provides a secure sandbox.
         *    - This execution bypasses the local script verification process but remains
         *      isolated and secure through Chrome's native sandboxing.
         *    - This mode requires explicit user activation and is intended for advanced users only.
         *
         * IMPORTANT:
         * Custom filters are ONLY supported when User scripts API permission is explicitly enabled.
         * This strict policy prevents Chrome Web Store rejection due to potential remote script execution.
         * When custom filters are allowed, they may contain:
         * 1. Network rules – converted to DNR rules and applied via dynamic rules.
         * 2. Cosmetic rules – interpreted directly in the extension code.
         * 3. Scriptlet and JS rules – executed via the browser's userScripts API (userScripts.execute)
         *    with Chrome's native sandboxing providing security isolation.
         *
         * For regular users without User scripts API permission (default case):
         * - Only pre-bundled filters with statically verified scripts are supported.
         * - Downloading custom filters or any rules from remote sources is blocked entirely
         *   to ensure compliance with the store policies.
         *
         * This implementation ensures perfect compliance with Chrome Web Store policies
         * by preventing any possibility of remote code execution for regular users.
         *
         * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
         */
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
     * @param params.args Optional arguments to pass to the script function.
     * @param params.world The execution world. Defaults to `'MAIN'`.
     *
     * @returns Promise that resolves when the script is executed.
     */
    public static async executeScriptFunc({
        tabId,
        frameId,
        scriptFunction,
        args,
        world = 'MAIN',
    }: ExecuteScriptFuncParams): Promise<void> {
        /**
         * This is STEP 4.2: Apply JS functions from pre-built filters — via chrome.scripting API.
         *
         * The whole process is explained below.
         *
         * To fully comply with Chrome Web Store policies regarding remote code execution,
         * we implement a strict security-focused approach for Scriptlet and JavaScript rules execution.
         *
         * 1. Default - regular users that did not grant User scripts API permission explicitly:
         *    - We collect and pre-build script rules from the filters and statically bundle
         *      them into the extension - STEP 1. See 'updateLocalResourcesForMv3' in our build tools.
         *      IMPORTANT: all scripts and their arguments are local and bundled within the extension.
         *    - These pre-verified local scripts are passed to the engine - STEP 2.
         *    - At runtime before the execution, we check if each script rule is included
         *      in our local scripts list (STEP 3).
         *    - Only pre-verified local scripts are executed via chrome.scripting API (STEP 4.1 and 4.2).
         *      All other scripts are discarded.
         *    - Custom filters are NOT allowed for regular users to prevent any possibility
         *      of remote code execution, regardless of rule interpretation.
         *
         * 2. For advanced users that explicitly granted User scripts API permission -
         *    via enabling the Developer mode or Allow user scripts in the extension details:
         *    - Custom filters are allowed and may contain Scriptlet and JS rules
         *      that can be executed using the browser's built-in userScripts API (STEP 4.3),
         *      which provides a secure sandbox.
         *    - This execution bypasses the local script verification process but remains
         *      isolated and secure through Chrome's native sandboxing.
         *    - This mode requires explicit user activation and is intended for advanced users only.
         *
         * IMPORTANT:
         * Custom filters are ONLY supported when User scripts API permission is explicitly enabled.
         * This strict policy prevents Chrome Web Store rejection due to potential remote script execution.
         * When custom filters are allowed, they may contain:
         * 1. Network rules – converted to DNR rules and applied via dynamic rules.
         * 2. Cosmetic rules – interpreted directly in the extension code.
         * 3. Scriptlet and JS rules – executed via the browser's userScripts API (userScripts.execute)
         *    with Chrome's native sandboxing providing security isolation.
         *
         * For regular users without User scripts API permission (default case):
         * - Only pre-bundled filters with statically verified scripts are supported.
         * - Downloading custom filters or any rules from remote sources is blocked entirely
         *   to ensure compliance with the store policies.
         *
         * This implementation ensures perfect compliance with Chrome Web Store policies
         * by preventing any possibility of remote code execution for regular users.
         *
         * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
         */
        await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            func: scriptFunction,
            args: args ?? [],
            injectImmediately: true,
            world,
        });
    }

    /**
     * Injects the pre-bundled ExtendedCSS engine and the matching rule strings
     * into the target frame and applies them. Runs in the ISOLATED world
     * (ExtendedCss only needs DOM access; `MutationObserver` in the isolated
     * world observes the same DOM, including page-JS mutations) and injects
     * immediately at `onCommitted` to minimize ad flash.
     *
     * The `func` is the static, self-contained `applyExtCss` function whose
     * body contains the inlined `@adguard/extended-css` engine,
     * so it survives `executeScript` serialization and satisfies the MV3
     * service-worker CSP (no `eval`/`new Function`).
     *
     * @param params Parameters for executing ExtendedCSS.
     * @param params.tabId The ID of the tab.
     * @param params.frameId The ID of the frame.
     * @param params.cssRules ExtendedCSS rule strings to apply.
     * @param params.collectStats Whether to register the CSS-hits
     * `beforeStyleApplied` callback in the injected func.
     *
     * @returns Promise that resolves when the engine + rules are injected.
     */
    public static async executeExtCss({
        tabId,
        frameId,
        cssRules,
        collectStats,
    }: ExecuteExtCssParams): Promise<void> {
        await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            func: applyExtCss,
            args: [cssRules, collectStats],
            injectImmediately: true,
            world: 'ISOLATED',
        });
    }
}
