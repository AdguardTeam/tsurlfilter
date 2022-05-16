export default class TabApi {
    static getActiveTab = (): Promise<chrome.tabs.Tab> => {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    reject(error);
                }

                const [tab] = tabs;
                resolve(tab);
            });
        });
    };
}
