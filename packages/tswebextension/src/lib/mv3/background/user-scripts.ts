import { logger } from '../../common/utils/logger';

import { type ExecuteCombinedScriptParams } from './scripting-api';

/**
 * Api for executing user scripts.
 */
export class UserScriptsApi {
    /**
     * Indicates whether user scripts are supported in the current browser.
     *
     * @returns `true` if user scripts are supported, `false` otherwise.
     */
    public static get areUserScriptsSupported(): boolean {
        try {
            return chrome.userScripts?.execute !== undefined;
        } catch (e) {
            return false;
        }
    }

    /**
     * Executes a list of user scripts in a specified tab and frame.
     *
     * @param params The parameters for executing the scripts.
     * @param params.scriptText Combined scripts and scriptlets texts to be injected.
     * @param params.tabId The ID of the tab where the scripts will be executed.
     * @param params.frameId The ID of the frame within the tab where the scripts will
     * be executed.
     *
     * @returns A promise that resolves when the scripts have been executed.
     *
     * @throws Will log an error if the script execution fails.
     */
    public static async executeScripts({
        scriptText,
        tabId,
        frameId,
    }: ExecuteCombinedScriptParams): Promise<void> {
        try {
            await chrome.userScripts.execute({
                target: {
                    frameIds: [frameId],
                    tabId,
                },
                injectImmediately: true,
                js: [{ code: scriptText }],
                world: 'MAIN',
            });
        } catch (e) {
            logger.error(`Failed to execute user script to tabId#frameId (${tabId}#${frameId}) :`, e);
        }
    }
}
