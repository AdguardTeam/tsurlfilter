/* eslint-disable class-methods-use-this */
import { browser, Cookies } from 'webextension-polyfill-ts';
import Cookie = Cookies.Cookie;

/**
 * Cookie api interface
 */
export interface IBrowserCookieApi {
    /**
     * Removes cookie
     *
     * @param name
     * @param url
     */
    removeCookie(name: string, url: string): Promise<void>;

    /**
     * Modifies cookie
     *
     * @param setCookie
     * @param url
     */
    modifyCookie(setCookie: Cookie, url: string): Promise<void>;
}

/**
 * Cookie api implementation
 */
export class BrowserCookieApi implements IBrowserCookieApi {
    /**
     * Removes cookie
     *
     * @param name
     * @param url
     */
    async removeCookie(name: string, url: string): Promise<void> {
        await browser.cookies.remove({ name, url });
    }

    /**
     * Updates cookie
     *
     * @param apiCookie Cookie for update
     * @param {string} url Cookie url
     */
    async modifyCookie(apiCookie: Cookie, url: string): Promise<void> {
        const update = { url, ...apiCookie };

        /**
         * Removes domain for host-only cookies:
         * https://developer.chrome.com/extensions/cookies#method-set
         * The domain of the cookie. If omitted, the cookie becomes a host-only cookie.
         */
        if (apiCookie.hostOnly) {
            delete update.domain;
        }

        // Unsupported properties
        delete update.hostOnly;
        delete update.session;
        // delete update.maxAge;

        await browser.cookies.set(update);
    }
}
