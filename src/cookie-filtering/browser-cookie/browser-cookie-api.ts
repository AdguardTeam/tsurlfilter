/* eslint-disable class-methods-use-this */
import { browser, Cookies } from 'webextension-polyfill-ts';
import OnChangedCause = Cookies.OnChangedCause;
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

    /**
     * Fetch cookies
     *
     * @param url
     */
    getCookies(url: string): Promise<Cookie[]>;

    /**
     * Fetch all cookies for specified domain
     *
     * @param domain
     */
    getDomainCookies(domain: string): Promise<Cookie[]>;

    /**
     * Fired when a cookie is set or removed.
     * As a special case, note that updating a cookie's properties is implemented as a two step process:
     * the cookie to be updated is first removed entirely, generating a notification with "cause" of "overwrite" .
     * Afterwards, a new cookie is written with the updated values,
     * generating a second notification with "cause" "explicit".
     * @param callback
     */
    setOnChangedListener(
        callback: (changeInfo: {
            removed: boolean;
            cookie: Cookie;
            cause: OnChangedCause;
        }) => void
    ): void;
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

    /**
     * Get cookies
     *
     * @param url
     */
    async getCookies(url: string): Promise<Cookie[]> {
        return browser.cookies.getAll({ url });
    }

    /**
     * Get domain cookies
     *
     * @param domain
     * @return {Array<BrowserApiCookie>}
     */
    async getDomainCookies(domain: string): Promise<Cookie[]> {
        return browser.cookies.getAll({ domain });
    }

    /**
     * Sets onChanged event listener
     * @param callback
     */
    setOnChangedListener(
        callback: (changeInfo: { removed: boolean; cookie: Cookies.Cookie; cause: Cookies.OnChangedCause }) => void,
    ): void {
        browser.cookies.onChanged.addListener(callback);
    }
}
