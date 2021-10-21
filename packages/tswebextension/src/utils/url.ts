import browser from 'webextension-polyfill';

/**
 * If referrer of request contains full url of extension,
 * then this request is considered as extension's own request
 * (e.g. request for filter downloading)
 * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1437
 */
export const isOwnUrl = (referrerUrl: string): boolean => {
    return referrerUrl.indexOf(browser.runtime.getURL('')) === 0;
};