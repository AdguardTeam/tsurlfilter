import { type ScriptletData } from '@adguard/tsurlfilter';
import { type IConfiguration } from '@adguard/scriptlets';

import { appContext } from './app-context';
import { BACKGROUND_TAB_ID } from '../../common/constants';
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
    scriptletRunData: ScriptletData,

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
     * @param params.scriptletRunData The scriptlet data to be executed.
     * @param params.domainName The domain name of the frame. Used for debugging.
     * @returns Promise that resolves when the script is executed.
     */
    public static async executeScriptlet(
        {
            tabId,
            frameId,
            scriptletRunData,
            domainName,
        }: ExecuteScriptletParams,
    ): Promise<void> {
        // There is no reason to inject a script into the background page
        if (tabId === BACKGROUND_TAB_ID) {
            return;
        }

        const params: IConfiguration = {
            ...scriptletRunData.params,
            uniqueId: String(appContext.startTimeMs),
            verbose: appContext.configuration?.settings.debugScriptlets || false,
            domainName: domainName ?? undefined,
        };

        await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            func: scriptletRunData.func,
            injectImmediately: true,
            world: 'MAIN',
            args: [params, scriptletRunData.params.args],
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
         * This is STEP 4.2: Apply JS functions from pre-built filters — via chrome.scripting API.
         */
        await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            func: scriptFunction,
            injectImmediately: true,
            world: 'MAIN',
        });
    }
}
