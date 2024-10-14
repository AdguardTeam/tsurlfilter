/**
 * A function that handles extension updates.
 *
 * @callback ChromeUpdateHandler
 * @param details Details about the installation event.
 */
export type ChromeUpdateHandler = (details: chrome.runtime.InstalledDetails) => void | Promise<void>;

/**
 * Checks if the current environment is Chrome.
 */
export const isChrome = typeof chrome !== 'undefined';

/**
 * Registers a handler to be executed after the extension has been updated to a newer version.
 *
 * @param {ChromeUpdateHandler} handler The function to be called when the extension updates.
 */
export const addChromeUpdateHandler = (handler: ChromeUpdateHandler): void => {
    if (!isChrome) {
        return;
    }

    const listener = (details: chrome.runtime.InstalledDetails): void => {
        if (details.reason === 'update') {
            handler(details);
            // Remove the listener after it's called to prevent multiple executions
            chrome.runtime.onInstalled.removeListener(listener);
        }
    };

    chrome.runtime.onInstalled.addListener(listener);
};
