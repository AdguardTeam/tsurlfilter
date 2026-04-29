import { logger } from '../../../common/utils/logger';

/**
 * Content script ID used for registering the $removeparam main-world script.
 */
const REMOVE_PARAM_CONTENT_SCRIPT_ID = 'removeParam';

/**
 * Manages registration of the main-world content script that patches
 * `history.pushState` / `history.replaceState` for `$removeparam` support.
 *
 * The script is registered with `world: 'MAIN'` so that it intercepts
 * History API calls made by the page's own JavaScript, not the isolated
 * content-script context.
 */
export class RemoveParamService {
    /**
     * Registers the main-world content script when filtering is enabled,
     * or unregisters it when disabled.
     *
     * @param filteringEnabled Whether filtering is currently enabled.
     * @param removeParamScriptUrl Path to the bundled main-world script.
     *
     * @returns The effective `filteringEnabled` value (may differ from the
     * requested value if registration fails).
     */
    public static async setRemoveParamScript(
        filteringEnabled: boolean,
        removeParamScriptUrl: string,
    ): Promise<boolean> {
        if (!filteringEnabled) {
            try {
                await RemoveParamService.removeContentScript();
                return false;
            } catch (e) {
                logger.error(
                    '[tsweb.RemoveParamService.setRemoveParamScript]: '
                    + 'error removing content script: ',
                    e,
                );
                return true;
            }
        }

        try {
            await RemoveParamService.setContentScript(removeParamScriptUrl);
            return true;
        } catch (e) {
            logger.error(
                '[tsweb.RemoveParamService.setRemoveParamScript]: '
                + 'error registering content script: ',
                e,
            );
            return false;
        }
    }

    /**
     * Removes the registered content script if it exists.
     */
    public static async clearAll(): Promise<void> {
        await RemoveParamService.removeContentScript();
    }

    /**
     * Registers (or re-registers) the content script.
     *
     * @param scriptUrl Path to the bundled main-world script.
     */
    private static async setContentScript(scriptUrl: string): Promise<void> {
        await RemoveParamService.removeContentScript();

        await chrome.scripting.registerContentScripts([{
            id: REMOVE_PARAM_CONTENT_SCRIPT_ID,
            js: [scriptUrl],
            world: 'MAIN',
            runAt: 'document_start',
            matches: [
                'http://*/*',
                'https://*/*',
            ],
            persistAcrossSessions: false,
        }]);
    }

    /**
     * Unregisters the content script if it is currently registered.
     */
    private static async removeContentScript(): Promise<void> {
        const existedContentScripts = await chrome.scripting.getRegisteredContentScripts({
            ids: [REMOVE_PARAM_CONTENT_SCRIPT_ID],
        });

        if (existedContentScripts.length > 0) {
            await chrome.scripting.unregisterContentScripts({
                ids: existedContentScripts.map((script) => script.id),
            });
        }
    }
}
