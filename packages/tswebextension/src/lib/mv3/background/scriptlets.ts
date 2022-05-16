import { CosmeticOption, ScriptletData } from '@adguard/tsurlfilter';
import { isHttpRequest } from '../../common/utils';
import { engineApi } from './engine-api';

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

    await chrome.scripting.executeScript({
        target: { tabId },
        func: functionToInject,
        world: 'MAIN', // ISOLATED doesnt allow to execute code inline
        args: [scripts],
    }, () => {
        if (chrome.runtime.lastError) {
            console.debug(chrome.runtime.lastError);
        }
    });
};

/**
 * Executes scriptlets data via chrome.scripting.executeScript api
 * @param tabId
 * @param scriptletsData
 */
const executeScriptletsData = async (
    tabId: number,
    scriptletsData: (ScriptletData | null)[],
    verbose?: boolean,
) => {
    const promises = scriptletsData.map(async (scriptletData) => {
        if (scriptletData === null) {
            return;
        }

        if (verbose !== undefined) {
            scriptletData.params.verbose = verbose;
        }

        await chrome.scripting.executeScript({
            target: { tabId },
            func: scriptletData.func,
            args: [scriptletData.params, scriptletData.params.args],
            world: 'MAIN',
        });
    });

    await Promise.all(promises);
};

/**
 * Get scripts and executing them
 * @param id
 * @param url
 */
export const getAndExecuteScripts = async (id: number, url: string, verbose?: boolean) => {
    const NEW_TAB_PAGE = 'new-tab-page'; // the url from the details have http even on the new tab page

    if (isHttpRequest(url) && !url.includes(NEW_TAB_PAGE)) {
        const response = await getScripts(url);
        await executeScript(response, id);

        const scriptletData = await getScriptletsDataList(url);
        await executeScriptletsData(id, scriptletData, verbose);
    }
};
