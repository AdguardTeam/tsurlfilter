import { CosmeticOption, ScriptletData } from '@adguard/tsurlfilter';

import { isHttpRequest } from '../../common/utils';
import { logger } from '../utils/logger';

import { engineApi } from './engine-api';
import { tabsApi } from './tabs-api';

// eslint-disable-next-line jsdoc/require-param
/**
 * @see {@link engineApi.getScriptsStringForUrl}
 */
const getScripts = async (url: string): Promise<string> => {
    // TODO: Extract cosmetic option from matching result (AG-24586)
    return engineApi.getScriptsStringForUrl(url, CosmeticOption.CosmeticOptionAll);
};

// eslint-disable-next-line jsdoc/require-param
/**
 * @see {@link engineApi.getScriptletsDataForUrl}
 */
const getScriptletsDataList = async (url: string): Promise<ScriptletData[]> => {
    // TODO: Extract cosmetic option from matching result (AG-24586)
    return engineApi.getScriptletsDataForUrl(url, CosmeticOption.CosmeticOptionAll);
};

/**
 * Executes provided scripts in the specified tab.
 *
 * @param scripts Scripts.
 * @param tabId Tab id.
 */
const executeScript = async (scripts: string, tabId: number): Promise<void> => {
    if (scripts.length === 0) {
        return;
    }

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
        await chrome.scripting.executeScript({
            target: { tabId },
            func: functionToInject,
            injectImmediately: true,
            world: 'MAIN', // ISOLATED doesn't allow to execute code inline
            args: [scripts],
        });
    } catch (e) {
        logger.debug(
            `Error on executeScript in the tab ${tabId}:`,
            chrome.runtime.lastError,
            e,
        );
    }
};

/**
 * Executes scriptlets data via chrome.scripting.executeScript api.
 *
 * @param tabId Tab id.
 * @param scriptletsData List of {@link ScriptletData}.
 * @param verbose Whether or not to pass the verbose flag to
 * scriptletData parameters.
 */
const executeScriptletsData = async (
    tabId: number,
    scriptletsData: ScriptletData[],
    verbose?: boolean,
): Promise<void> => {
    const promises = scriptletsData.map(async (scriptletData) => {
        if (verbose !== undefined) {
            scriptletData.params.verbose = verbose;
        }

        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                func: scriptletData.func,
                injectImmediately: true,
                world: 'MAIN', // ISOLATED doesn't allow to execute code inline
                args: [scriptletData.params, scriptletData.params.args],
            });
        } catch (e) {
            logger.debug(
                `Error on executeScriptlet in the tab ${tabId}:`,
                chrome.runtime.lastError,
                e,
            );
        }
    });

    await Promise.all(promises);
};

/**
 * Get scripts and executing them.
 *
 * @param tabId Tab id.
 * @param url Page URL.
 * @param verbose Whether or not to pass the verbose flag to
 * scriptletData parameters.
 */
export const getAndExecuteScripts = async (
    tabId: number,
    url: string,
    verbose?: boolean,
): Promise<void> => {
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
        const response = await getScripts(url);
        await executeScript(response, tabId);

        const scriptletData = await getScriptletsDataList(url);
        await executeScriptletsData(tabId, scriptletData, verbose);
    }
};
