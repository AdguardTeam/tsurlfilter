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
 * Parameters for executing script function or scriptlet.
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
     * The script functions to be executed.
     */
    scriptTexts?: string[],

    /**
     * List of the scriptlets data to be executed.
     */
    scriptletDataList?: ScriptletData[],

    /**
     * The domain name of the frame.
     */
    domainName?: string | null,
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
     * Updates the scripts to execute in the tab via user scripts manager.
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
    public static async updateScriptsToExecute({
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

        let combinedScriptTexts: string[] = [];

        if (scriptTexts) {
            combinedScriptTexts = combinedScriptTexts.concat(scriptTexts);
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

            combinedScriptTexts = combinedScriptTexts.concat(scriptletTexts);
        }

        await UserScriptsManager.updateExecutor(combinedScriptTexts, frameId === MAIN_FRAME_ID);
    }
}
