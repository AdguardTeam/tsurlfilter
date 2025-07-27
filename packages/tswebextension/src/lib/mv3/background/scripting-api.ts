import { type ScriptletData } from '@adguard/tsurlfilter';
import { type Source } from '@adguard/scriptlets';

import { BACKGROUND_TAB_ID } from '../../common/constants';

import { appContext } from './app-context';
import { type LocalScriptFunction } from './services/local-script-rules-service';

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
     *
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

        const params: Source = {
            ...scriptletData.params,
            uniqueId: String(appContext.startTimeMs),
            verbose: appContext.configuration?.settings.debugScriptlets || false,
            domainName: domainName ?? undefined,
        };

        /**
         * Search for 'JS_RULES_EXECUTION' to find all parts of script execution
         * process in the extension.
         *
         * 1. We collect and bundle all scripts that can be executed on web pages into
         *    the extension package into so-called `localScriptRules`.
         * 2. Rules that control when and where these scripts can be executed are also
         *    bundled within the extension package inside ruleset files.
         * 3. The rules look like: `example.org#%#scripttext`. Whenever the rule is
         *    matched, we check if there's a function for `scripttext` in
         *    `localScriptRules`, retrieve it from there and execute it.
         *
         * Here we're applying JS functions of scriptlets from pre-built filters via chrome.scripting API.
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
         * Search for 'JS_RULES_EXECUTION' to find all parts of script execution
         * process in the extension.
         *
         * 1. We collect and bundle all scripts that can be executed on web pages into
         *    the extension package into so-called `localScriptRules`.
         * 2. Rules that control when and where these scripts can be executed are also
         *    bundled within the extension package inside ruleset files.
         * 3. The rules look like: `example.org#%#scripttext`. Whenever the rule is
         *    matched, we check if there's a function for `scripttext` in
         *    `localScriptRules`, retrieve it from there and execute it.
         *
         * Here we're applying JS functions from pre-built filters via chrome.scripting API.
         */
        await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            func: scriptFunction,
            injectImmediately: true,
            world: 'MAIN',
        });
    }
}
