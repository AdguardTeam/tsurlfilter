import { CosmeticOption, ScriptletData } from '@adguard/tsurlfilter';
import { isHttpRequest } from '../../common/utils';
import { engineApi } from './engine-api';
import { tabsApi } from './tabs-api';

const getScripts = async (url: string) => {
    return engineApi.getScriptsStringForUrl(url, CosmeticOption.CosmeticOptionAll);
};

const getScriptletsDataList = async (url: string) => {
    return engineApi.getScriptletsDataForUrl(url, CosmeticOption.CosmeticOptionAll);
};

const executeScript = async (scripts: string, tabId: number) => {
    if (scripts.length === 0) {
        return;
    }

    const functionToInject = (script: string) => {
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
        console.debug('Error on executeScript', e);
    }
};

/**
 * Executes scriptlets data via chrome.scripting.executeScript api
 * @param tabId
 * @param scriptletsData
 * @param verbose
 */
const executeScriptletsData = async (
    tabId: number,
    scriptletsData: ScriptletData[],
    verbose?: boolean,
) => {
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
            console.debug('Error on executeScript', e);
        }
    });

    await Promise.all(promises);
};

/**
 * Get scripts and executing them
 * @param id
 * @param url
 * @param verbose
 */
export const getAndExecuteScripts = async (id: number, url: string, verbose?: boolean) => {
    /**
     * The url from the details have http even on the new tab page
     */
    const NEW_TAB_PAGE = 'new-tab-page';

    /**
     * In the case when the frame does not have a source, we use the url of the main frame
     */
    if (!isHttpRequest(url)) {
        url = tabsApi.getMainFrameUrl(id) || '';
    }

    if (isHttpRequest(url) && !url.includes(NEW_TAB_PAGE)) {
        const response = await getScripts(url);
        await executeScript(response, id);

        const scriptletData = await getScriptletsDataList(url);
        await executeScriptletsData(id, scriptletData, verbose);
    }
};
