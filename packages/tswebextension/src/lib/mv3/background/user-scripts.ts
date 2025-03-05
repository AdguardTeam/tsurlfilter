import { logger } from '../../common/utils/logger';

export interface ExecuteScriptsParams {
    scripts: string[];
    tabId: number;
    frameId: number;
}

/**
 * Manager for user scripts.
 */
export class UserScriptsManager {
    /**
     * Indicates whether user scripts are supported in the current browser.
     *
     * @returns `true` if user scripts are supported, `false` otherwise.
     */
    static get isUserScriptsSupported(): boolean {
        return !!chrome.userScripts;
    }

    /**
     * Executes a list of user scripts in a specified tab and frame.
     *
     * @param params The parameters for executing the scripts.
     * @param params.scripts An array of strings, each representing a script
     * to be executed.
     * @param params.tabId The ID of the tab where the scripts will be executed.
     * @param params.frameId The ID of the frame within the tab where the scripts will
     * be executed.
     *
     * @returns A promise that resolves when the scripts have been executed.
     *
     * @throws Will log an error if the script execution fails.
     */
    static async executeScripts({
        scripts,
        tabId,
        frameId,
    }: ExecuteScriptsParams): Promise<void> {
        try {
            await chrome.userScripts.execute({
                target: {
                    frameIds: [frameId],
                    tabId,
                },
                injectImmediately: true,
                js: scripts.map((script) => ({ code: script })),
                world: 'MAIN',
            });
        } catch (e) {
            logger.error(`Failed to execute user script to frameId#tabId (${frameId}#${tabId}) :`, e);
        }
    }
}
