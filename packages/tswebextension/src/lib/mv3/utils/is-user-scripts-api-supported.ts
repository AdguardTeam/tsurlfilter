/**
 * Indicates whether user scripts API is supported in the current browser.
 *
 * Separate function to avoid exporting the whole UserScriptsApi class and
 * export only the necessary functionality.
 *
 * @returns `true` if user scripts API is supported, `false` otherwise.
 */
export const isUserScriptsApiSupported = (): boolean => {
    /**
     * Double calls to API is needed to unsure that Chrome userScripts API
     * is available and that it has the execute method defined.
     */
    try {
        /**
         * Just check if the API is available.
         * If it is not available, this will throw an error.
         */
        chrome.userScripts.getScripts();

        /**
         * If the API is available, check if execute method is defined,
         * because it is available only from Chrome 135+.
         */
        return chrome.userScripts?.execute !== undefined;
    } catch (e) {
        return false;
    }
};
