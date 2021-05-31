/* eslint-disable no-undef */

/**
 * Executes stealth scripts
 */
export const injectStealthScripts = (tabId, sendDoNotTrack) => {
    if (!sendDoNotTrack) {
        return;
    }

    chrome.tabs.executeScript(tabId, {
        code: `
                (() => {
                    const { StealthHelper } = TSUrlFilterContentScript;
                    StealthHelper.setDomSignal();
                })();
            `,
    });
};
