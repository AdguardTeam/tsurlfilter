/* eslint-disable no-undef */

/**
 * Resources directory
 *
 * @type {string}
 */
const WEB_ACCESSIBLE_RESOURCES = 'war';

/**
 * Foil ability of web pages to identify uBO through its web accessible resources.
 *
 * Inspired by:
 * https://github.com/gorhill/uBlock/blob/7f999b759fe540e457e297363f55b25d9860dd3e/platform/chromium/vapi-background.js
 */
const warSecret = (() => {
    const generateSecret = () => Math.floor(Math.random() * 982451653 + 982451653).toString(36);

    const root = chrome.runtime.getURL('/');
    const secrets = [];
    let lastSecretTime = 0;

    // eslint-disable-next-line consistent-return
    const guard = function (details) {
        const { url } = details;
        const pos = secrets.findIndex((secret) => url.lastIndexOf(`?secret=${secret}`) !== -1);
        if (pos === -1) {
            return { redirectUrl: root };
        }
        secrets.splice(pos, 1);
    };

    chrome.webRequest.onBeforeRequest.addListener(
        guard,
        {
            urls: [`${root}${WEB_ACCESSIBLE_RESOURCES}/*`],
        },
        ['blocking'],
    );

    return () => {
        if (secrets.length !== 0) {
            if ((Date.now() - lastSecretTime) > 5000) {
                secrets.splice(0);
            } else if (secrets.length > 256) {
                secrets.splice(0, secrets.length - 192);
            }
        }
        lastSecretTime = Date.now();
        const secret = generateSecret();
        secrets.push(secret);
        return `?secret=${secret}`;
    };
})();

/**
 * Load resources by path
 *
 * @param path
 * @return {Promise<string>}
 */
export async function loadResource(path) {
    const url = chrome.runtime.getURL(`/${WEB_ACCESSIBLE_RESOURCES}/${path}${warSecret()}`);
    const response = await fetch(url);
    return response.text();
}

/**
 * Create url for redirect file
 *
 * @param redirectFile
 * @return {*}
 */
export function createRedirectFileUrl(redirectFile) {
    return chrome.runtime.getURL(`${WEB_ACCESSIBLE_RESOURCES}/redirects/${redirectFile}${warSecret()}`);
}
