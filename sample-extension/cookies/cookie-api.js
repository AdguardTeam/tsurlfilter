/* eslint-disable no-console, no-undef */

/**
 * Removes cookie
 *
 * @param {string} name Cookie name
 * @param {string} url Cookie url
 * @return {Promise<any>}
 */
export const apiRemoveCookie = (name, url) => new Promise((resolve) => {
    chrome.cookies.remove({ url, name }, () => {
        const ex = chrome.runtime.lastError;
        if (ex) {
            console.error(`Error remove cookie ${name} - ${url}: ${ex}`);
        }
        resolve();
    });
});

/**
 * Updates cookie
 *
 * @param {BrowserApiCookie} apiCookie Cookie for update
 * @param {string} url Cookie url
 * @return {Promise<any>}
 */
export const apiUpdateCookie = (apiCookie, url) => {
    const update = {
        url,
        name: apiCookie.name,
        value: apiCookie.value,
        domain: apiCookie.domain,
        path: apiCookie.path,
        secure: apiCookie.secure,
        httpOnly: apiCookie.httpOnly,
        sameSite: apiCookie.sameSite,
        expirationDate: apiCookie.expirationDate,
    };
    /**
     * Removes domain for host-only cookies:
     * https://developer.chrome.com/extensions/cookies#method-set
     * The domain of the cookie. If omitted, the cookie becomes a host-only cookie.
     */
    if (apiCookie.hostOnly) {
        delete update.domain;
    }

    return new Promise((resolve) => {
        chrome.cookies.set(update, () => {
            const ex = chrome.runtime.lastError;
            if (ex) {
                console.error(`Error update cookie ${apiCookie.name} - ${url}: ${ex}`);
            }
            resolve();
        });
    });
};

/**
 * Get all cookies by name and url
 *
 * @param {string} name Cookie name
 * @param {string} url Cookie url
 * @return {Promise<Array.<BrowserApiCookie>>} array of cookies
 */
export const apiGetCookies = (name, url) => new Promise((resolve) => {
    chrome.cookies.getAll({ name, url }, (cookies) => {
        resolve(cookies || []);
    });
});
