import { CosmeticOption, type ScriptletData } from '@adguard/tsurlfilter';
import browser from 'webextension-polyfill';

import { isHttpRequest } from '../../common/utils/url';
import { logger } from '../../common/utils/logger';

import { engineApi } from './engine-api';
import { tabsApi } from '../tabs/tabs-api';

/**
 * TODO: Should be moved into CosmeticApi as in MV2.
 *
 * API for find and inject script and scriptlets into tabs.
 */
export class CosmeticJsApi {
    /**
     * Is verbose mode set for scripts or not, which will be passes to
     * scriptletData parameters.
     */
    public static verbose = false;

    /**
     * Executes provided scripts in the specified tab.
     *
     * @param scripts Scripts.
     * @param tabId Tab id.
     */
    public static async executeScript(scripts: string, tabId: number): Promise<void> {
        const functionToInject = (script: string): void => {
            const scriptTag = document.createElement('script');
            scriptTag.setAttribute('type', 'text/javascript');
            scriptTag.textContent = script;

            const parent = document.head || document.documentElement;
            parent.appendChild(scriptTag);

            if (scriptTag.parentNode) {
                scriptTag.parentNode.removeChild(scriptTag);
            }
        };

        try {
            await browser.scripting.executeScript({
                target: { tabId },
                func: functionToInject,
                injectImmediately: true,
                // TODO fix later, MAIN is not supported by webextension-polyfill
                // @ts-ignore
                world: 'MAIN', // ISOLATED doesn't allow to execute code inline
                args: [scripts],
            });
        } catch (e) {
            logger.debug(
                `[tswebextension.executeScript]: Error on executeScript in the tab ${tabId}:`,
                browser.runtime.lastError,
                e,
            );
        }
    }

    /**
     * Executes scriptlets data via browser.scripting.executeScript api.
     *
     * @param tabId Tab id.
     * @param scriptletsData List of {@link ScriptletData}.
     */
    public static async executeScriptletsData(
        tabId: number,
        scriptletsData: ScriptletData[],
    ): Promise<void> {
        const promises = scriptletsData.map(async (scriptletData) => {
            scriptletData.params.verbose = CosmeticJsApi.verbose;

            try {
                await browser.scripting.executeScript({
                    target: { tabId },
                    func: scriptletData.func,
                    injectImmediately: true,
                    // FIXME later
                    // @ts-ignore
                    world: 'MAIN', // ISOLATED doesn't allow to execute code inline
                    args: [scriptletData.params, scriptletData.params.args],
                });
            } catch (e) {
                logger.debug(
                    `[tswebextension.executeScriptletsData]: Error on executeScriptlet in the tab ${tabId}:`,
                    browser.runtime.lastError,
                    e,
                );
            }
        });

        await Promise.all(promises);
    }

    /**
     * Get scripts and executing them.
     *
     * @param tabId Tab id.
     * @param url Page URL.
     */
    public static async getAndExecuteScripts(
        tabId: number,
        url: string,
    ): Promise<void> {
    /**
     * The url from the details have http even on the new tab page.
     */
        const NEW_TAB_PAGE = 'new-tab-page';

        /**
         * In the case when the frame does not have a source, we use the url of the main frame.
         */
        if (!isHttpRequest(url)) {
            url = tabsApi.getMainFrameUrl(tabId) || '';
        }

        if (isHttpRequest(url) && !url.includes(NEW_TAB_PAGE)) {
            // TODO: Extract cosmetic option from matching result (AG-24586)
            const wrappedScript = engineApi.getScriptsStringForUrl(url, CosmeticOption.CosmeticOptionAll);
            if (wrappedScript) {
                await CosmeticJsApi.executeScript(wrappedScript, tabId);
            }

            // TODO: Extract cosmetic option from matching result (AG-24586)
            const scriptletData = engineApi.getScriptletsDataForUrl(url, CosmeticOption.CosmeticOptionAll);
            await CosmeticJsApi.executeScriptletsData(tabId, scriptletData);
        }
    }
}
