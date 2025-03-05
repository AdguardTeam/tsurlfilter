import { type ScriptletData } from '@adguard/tsurlfilter';
import { type Source } from '@adguard/scriptlets';

import { BACKGROUND_TAB_ID } from '../../common/constants';

import { appContext } from './app-context';
import { type LocalScriptFunction } from './services/local-script-rules-service';
import { UserScriptsApi } from './user-scripts';

/**
 * Parameters for applying CSS rules.
 */
export type InsertCSSParams = {
    tabId: number,
    frameId: number,
    cssText: string,
};

type ExecuteTarget = {
    /**
     * The ID of the tab.
     */
    tabId: number,

    /**
     * The ID of the frame.
     */
    frameId: number,
};

/**
 * Parameters for executing script function.
 */
export type ExecuteScriptFuncParams = ExecuteTarget & {
    /**
     * The script function to be executed.
     */
    scriptFunction: LocalScriptFunction,
};

/**
 * Parameters for executing scriptlet.
 */
export type ExecuteScriptletParams = ExecuteTarget & {
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
 * Parameters for executing script function or scriptlet.
 */
type ExecuteScriptParams = ExecuteTarget
& Pick<ExecuteScriptletParams, 'domainName'>
& {
    /**
     * The script functions to be executed.
     */
    scriptTexts?: string[],

    /**
     * List of the scriptlets data to be executed.
     */
    scriptletDataList?: ScriptletData[],
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
     * @param params Parameters for executing the scripts or scriptlets.
     * @param params.tabId The ID of the tab.
     * @param params.frameId The ID of the frame.
     * @param params.scriptTexts The script functions to be executed.
     * @param params.scriptletDataList List of the scriptlets data to be executed.
     * @param params.domainName The domain name of the frame. Used for debugging.
     *
     * @returns Promise that resolves when the scripts are executed.
     */
    public static async executeScriptsViaUserScripts({
        tabId,
        frameId,
        scriptTexts,
        scriptletDataList,
        domainName,
    }: ExecuteScriptParams): Promise<void> {
        // There is no reason to inject a script into the background page
        if (tabId === BACKGROUND_TAB_ID) {
            return;
        }

        let scripts: string[] = [];

        if (scriptTexts) {
            scripts = scripts.concat(scriptTexts);
        }

        if (scriptletDataList) {
            const scriptletTexts = scriptletDataList.map((scriptletData) => {
                const params: Source = {
                    ...scriptletData.params,
                    uniqueId: String(appContext.startTimeMs),
                    verbose: appContext.configuration?.settings.debugScriptlets || false,
                    domainName: domainName ?? undefined,
                };

                return `
                    (${scriptletData.func.toString()})(...${JSON.stringify([params, scriptletData.params.args])});
                `;
            });

            scripts = scripts.concat(scriptletTexts);
        }

        if (scripts.length === 0) {
            return;
        }

        await UserScriptsApi.executeScripts({
            frameId,
            tabId,
            scripts,
        });
    }
}
