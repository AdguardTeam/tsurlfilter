import { CosmeticOption } from '@adguard/tsurlfilter';
import browser from 'webextension-polyfill';

import { logger } from '../../common/utils/logger';

import { engineApi } from './engine-api';
import { tabsApi } from '../tabs/tabs-api';
import { isHttpRequest } from '../../common/utils/url';

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
            let executeScriptPromise = Promise.resolve();
            if (wrappedScript) {
                executeScriptPromise = CosmeticJsApi.executeScript(wrappedScript, tabId);
            }

            await Promise.all([executeScriptPromise]);
        }
    }
}
