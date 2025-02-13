import { logger } from '../../common/utils/logger';

/**
 * Manager for user scripts.
 */
export class UserScriptsManager {
    private static readonly EXECUTOR_ID = 'executor';

    private static readonly EMPTY_SCRIPTS_TO_INJECT = [{ code: '' }];

    /**
     * Initializes the UserScriptsManager.
     *
     * @returns A promise that resolves when the UserScriptsManager is initialized.
     */
    public static async start(): Promise<void> {
        try {
            await UserScriptsManager.registerExecutor();

            // FIXME: Check if this is needed.
            await chrome.userScripts.configureWorld({ csp: 'MAIN' });
        } catch (e) {
            logger.error('Failed to start UserScriptsManager:', e);
        }
    }

    /**
     * Unregisters the user script executor.
     * This function unregisters the user script from the Chrome extension API.
     *
     * @returns A promise that resolves when the user script is unregistered.
     */
    public static async stop(): Promise<void> {
        try {
            await chrome.userScripts.unregister({ ids: [UserScriptsManager.EXECUTOR_ID] });
        } catch (e) {
            logger.error('Failed to stop UserScriptsManager:', e);
        }
    }

    /**
     * Registers the user script executor.
     * This function registers a user script with the Chrome extension API.
     * The script will match all URLs and run in all frames at document start.
     *
     * @returns A promise that resolves when the user script is registered.
     */
    private static async registerExecutor(): Promise<void> {
        try {
            await chrome.userScripts.register([{
                id: UserScriptsManager.EXECUTOR_ID,
                matches: ['*://*/*'],
                allFrames: true,
                // Code will be dynamically generated and updated.
                js: UserScriptsManager.EMPTY_SCRIPTS_TO_INJECT,
                runAt: 'document_start',
                world: 'MAIN',
            }]);
        } catch (e) {
            logger.error('Failed to register user script executor:', e);
        }
    }

    /**
     * Updates the user script executor with new code.
     * This function updates the registered user script with new JavaScript code.
     *
     * @param scripts Scripts to run in the user script executor.
     * @param allFrames Whether the script should run in all frames.
     *
     * @returns A promise that resolves when the user script is updated.
     */
    static async updateExecutor(scripts: string[], allFrames: boolean): Promise<void> {
        try {
            const areScriptsEmpty = scripts.length === 0 || scripts.every((script) => !script);
            await chrome.userScripts.update([{
                id: UserScriptsManager.EXECUTOR_ID,
                matches: ['*://*/*'],
                allFrames,
                js: areScriptsEmpty
                    ? UserScriptsManager.EMPTY_SCRIPTS_TO_INJECT
                    : scripts.map((script) => ({ code: script })),
                runAt: 'document_start',
                world: 'MAIN',
            }]);
        } catch (e) {
            logger.error('Failed to update user script executor:', e);
        }
    }
}
