interface RegexOptions {
    regex: string;
}

type IsRegexSupportedResult = chrome.declarativeNetRequest.IsRegexSupportedResult;

/**
 * Check if the regex is supported in a browser extension using the built-in chrome.declarativeNetRequest API.
 *
 * @param regexFilter Regex to check.
 * @returns Promise that resolves to true if the regex is supported, and rejects with an error otherwise.
 */
export const regexValidatorExtension = async (regexFilter: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        if (typeof chrome !== 'undefined' && chrome.declarativeNetRequest) {
            const regexOptions: RegexOptions = { regex: regexFilter };
            chrome.declarativeNetRequest.isRegexSupported(regexOptions, (result: IsRegexSupportedResult) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else if (result.isSupported) {
                    resolve(true);
                } else {
                    reject(new Error(result.reason));
                }
            });
        } else {
            reject(new Error('chrome.declarativeNetRequest is not available'));
        }
    });
};
