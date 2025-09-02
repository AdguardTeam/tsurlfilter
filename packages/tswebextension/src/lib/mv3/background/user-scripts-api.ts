import { logger } from '../../common/utils/logger';
import { isUserScriptsApiEnabled } from '../utils/is-user-scripts-api-enabled';

import { appContext } from './app-context';
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
    // eslint-disable-next-line jsdoc/require-description, jsdoc/require-returns
    /**
     * @see {@link isUserScriptsApiEnabled}.
     */
    public static get isEnabled(): boolean {
        return isUserScriptsApiEnabled();
    }

    /**
     * This is STEP 4.3: if User scripts API permission is explicitly granted,
     * all Scriptlet and JS rules (including those from custom filters)
     * are executed using the browser's built-in userScripts API.
     * This execution path bypasses the local script verification
     * but remains secure through Chrome's native sandbox isolation.
     *
     * The whole process is explained below.
     *
     * To fully comply with Chrome Web Store policies regarding remote code execution,
     * we implement a strict security-focused approach for Scriptlet and JavaScript rules execution.
     *
     * 1. Default - regular users that did not grant User scripts API permission explicitly:
     *    - We collect and pre-build script rules from the filters and statically bundle
     *      them into the extension - STEP 1. See 'updateLocalResourcesForChromiumMv3' in our build tools.
     *      IMPORTANT: all scripts and their arguments are local and bundled within the extension.
     *    - These pre-verified local scripts are passed to the engine - STEP 2.
     *    - At runtime before the execution, we check if each script rule is included
     *      in our local scripts list (STEP 3).
     *    - Only pre-verified local scripts are executed via chrome.scripting API (STEP 4.1 and 4.2).
     *      All other scripts are discarded.
     *    - Custom filters are NOT allowed for regular users to prevent any possibility
     *      of remote code execution, regardless of rule interpretation.
     *
     * 2. For advanced users that explicitly granted User scripts API permission -
     *    via enabling the Developer mode or Allow user scripts in the extension details:
     *    - Custom filters are allowed and may contain Scriptlet and JS rules
     *      that can be executed using the browser's built-in userScripts API (STEP 4.3),
     *      which provides a secure sandbox.
     *    - This execution bypasses the local script verification process but remains
     *      isolated and secure through Chrome's native sandboxing.
     *    - This mode requires explicit user activation and is intended for advanced users only.
     *
     * IMPORTANT:
     * Custom filters are ONLY supported when User scripts API permission is explicitly enabled.
     * This strict policy prevents Chrome Web Store rejection due to potential remote script execution.
     * When custom filters are allowed, they may contain:
     * 1. Network rules – converted to DNR rules and applied via dynamic rules.
     * 2. Cosmetic rules – interpreted directly in the extension code.
     * 3. Scriptlet and JS rules – executed via the browser's userScripts API (userScripts.execute)
     *    with Chrome's native sandboxing providing security isolation.
     *
     * For regular users without User scripts API permission (default case):
     * - Only pre-bundled filters with statically verified scripts are supported.
     * - Downloading custom filters or any rules from remote sources is blocked entirely
     *   to ensure compliance with the store policies.
     *
     * This implementation ensures perfect compliance with Chrome Web Store policies
     * by preventing any possibility of remote code execution for regular users.
     *
     * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
     */
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
        const code = UserScriptsApi.wrapScriptCode(
            String(appContext.startTimeMs),
            String(scriptText),
        );

        try {
            await chrome.userScripts.execute({
                target: {
                    frameIds: [frameId],
                    tabId,
                },
                injectImmediately: true,
                js: [{ code }],
                world: 'MAIN',
            });
        } catch (e) {
            logger.info(`[tsweb.UserScriptsApi.executeScripts]: failed to execute user script to tabId ${tabId} and frameId ${frameId} due to:`, e);
        }
    }

    /**
     * Wraps the script code with a try-catch block and a check to avoid
     * multiple executions of it.
     *
     * @param injectedKey Unique key to identify that the script
     * has been injected to this namespace.
     * @param code Script code.
     *
     * @returns Wrapped script code.
     */
    private static wrapScriptCode(injectedKey: string, code: string): string {
        return `
            (function () {
                try {
                    const flag = 'done';
                    if (Window.prototype.toString["${injectedKey}"] === flag) {
                        return;
                    }
                    ${code}
                    Object.defineProperty(Window.prototype.toString, "${injectedKey}", {
                        value: flag,
                        enumerable: false,
                        writable: false,
                        configurable: false
                    });
                } catch (error) {
                    console.error('Error executing AG js rule with uniqueId "${injectedKey}" due to:', error);
                }
            })()
        `;
    }
}
