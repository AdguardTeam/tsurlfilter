import { logger } from '../../common/utils/logger';

import { type ExecuteCombinedScriptParams } from './scripting-api';

/**
 * Api for executing user scripts.
 *
 * Note: This API is only utilized in developer mode as an additional
 * safety measure to comply with Chrome Web Store policies. In normal operation,
 * only pre-verified statically bundled scripts are executed.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/api/userScripts}
 */
export class UserScriptsApi {
    /**
     * Indicates whether user scripts API is supported in the current browser.
     *
     * @returns `true` if user scripts API is supported, `false` otherwise.
     */
    public static get isSupported(): boolean {
        try {
            return chrome.userScripts?.execute !== undefined;
        } catch (e) {
            return false;
        }
    }

    /**
     * Executes a list of user scripts in a specified tab and frame.
     *
     * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
     *
     * This is STEP 4.3: For developer mode only - JavaScript rules from custom filters:
     * - When developer mode is explicitly enabled, all JavaScript rules (including those from custom filters)
     *   are executed using the browser's built-in userScripts API.
     * - This execution path bypasses the local script verification but remains secure through
     *   Chrome's native sandbox isolation.
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
