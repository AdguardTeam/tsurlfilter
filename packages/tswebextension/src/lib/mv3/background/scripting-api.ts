import { type ScriptletData } from '@adguard/tsurlfilter';
import { type Source } from '@adguard/scriptlets';

import { BACKGROUND_TAB_ID, MAIN_FRAME_ID } from '../../common/constants';

import { appContext } from './app-context';
import { UserScriptsManager } from './user-scripts';

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
     * The script functions to be executed.
     */
    scriptTexts: string[],
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
     * List of the scriptlets data to be executed.
     */
    scriptletDataList: ScriptletData[],

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
     * @param params.scriptletDataList List of the scriptlets data to be executed.
     * @param params.domainName The domain name of the frame. Used for debugging.
     *
     * @returns Promise that resolves when the script is executed.
     */
    public static async executeScriptlet({
        tabId,
        frameId,
        scriptletDataList,
        domainName,
    }: ExecuteScriptletParams): Promise<void> {
        // There is no reason to inject a script into the background page
        if (tabId === BACKGROUND_TAB_ID) {
            return;
        }

        const scriptTexts = scriptletDataList.map((scriptletData) => {
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

        await UserScriptsManager.updateExecutor(scriptTexts, frameId === MAIN_FRAME_ID);
    }

    /**
     * Executes a script within the scope of the page.
     *
     * @param params Parameters for executing the script.
     * @param params.tabId The ID of the tab.
     * @param params.frameId The ID of the frame.
     * @param params.scriptTexts The scripts functions to be executed.
     *
     * @returns Promise that resolves when the script is executed.
     */
    public static async executeScriptFunc({
        tabId,
        frameId,
        scriptTexts,
    }: ExecuteScriptFuncParams): Promise<void> {
        // There is no reason to inject a script into the background page
        if (tabId === BACKGROUND_TAB_ID) {
            return;
        }

        // FIXME: Find a way to inject scripts into the specified frame.
        await UserScriptsManager.updateExecutor(scriptTexts, frameId === MAIN_FRAME_ID);
    }
}
