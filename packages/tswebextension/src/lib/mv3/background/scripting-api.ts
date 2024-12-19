import { type ScriptletData } from '@adguard/tsurlfilter';
import { type IConfiguration } from '@adguard/scriptlets';

import { appContext } from './app-context';
import { BACKGROUND_TAB_ID } from '../../common/constants';

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
     *
     * @returns Promise that resolves when the script is executed.
     */
    public static async executeScript({
        tabId,
        frameId,
    }: ExecuteScriptParams): Promise<void> {
        // There is no reason to inject a script into the background page
        if (tabId === BACKGROUND_TAB_ID) {
            return;
        }

        await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            // TODO: execute JS rules AG-38560
            // func: injectFunc,
            // TODO: OR maybe `files` can be used to execute JS rules
            files: [],
            injectImmediately: true,
            world: 'MAIN', // ISOLATED doesn't allow to execute code inline
        });
    }
}
