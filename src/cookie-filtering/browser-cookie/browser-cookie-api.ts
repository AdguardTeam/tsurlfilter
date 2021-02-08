/* eslint-disable class-methods-use-this */
import { browser, Cookies } from 'webextension-polyfill-ts';
import ParsedCookie from '../parsed-cookie';
import SetDetailsType = Cookies.SetDetailsType;
import SameSiteStatus = Cookies.SameSiteStatus;

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
     * @param cookie
     */
    modifyCookie(cookie: ParsedCookie): Promise<void>;
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
     * @param cookie Cookie for update
     */
    async modifyCookie(cookie: ParsedCookie): Promise<void> {
        const update = BrowserCookieApi.convertToSetDetailsType(cookie);
        await browser.cookies.set(update);
    }

    private static convertToSetDetailsType(cookie: ParsedCookie): SetDetailsType {
        return {
            /**
             * The request-URI to associate with the setting of the cookie.
             * This value can affect the default domain and path values of the created cookie.
             * If host permissions for this URL are not specified in the manifest file, the API call will fail.
             */
            url: cookie.url,

            /**
             * The name of the cookie. Empty by default if omitted.
             * Optional.
             */
            name: cookie.name,

            /**
             * The value of the cookie. Empty by default if omitted.
             * Optional.
             */
            value: cookie.value,

            /**
             * The domain of the cookie. If omitted, the cookie becomes a host-only cookie.
             * Optional.
             */
            domain: cookie.domain,

            /**
             * Whether the cookie should be marked as Secure. Defaults to false.
             * Optional.
             */
            secure: cookie.secure,

            /**
             * Whether the cookie should be marked as HttpOnly. Defaults to false.
             * Optional.
             */
            httpOnly: cookie.httpOnly,

            /**
             * The cookie's same-site status.
             * Optional.
             */
            sameSite: BrowserCookieApi.getSameSiteStatus(cookie.sameSite),

            /**
             * The expiration date of the cookie as the number of seconds since the UNIX epoch.
             * If omitted, the cookie becomes a session cookie.
             * Optional.
             */
            expirationDate: cookie.expires ? cookie.expires.getTime() : undefined,

            // /**
            //  * The first-party domain of the cookie. This attribute is required if First-Party Isolation is enabled.
            //  * Optional.
            //  */
            // firstPartyDomain?: string;
        };
    }

    /**
     * Returns same-site type
     *
     * @param sameSite
     */
    private static getSameSiteStatus(sameSite: string | undefined): SameSiteStatus {
        if (sameSite) {
            if (sameSite.toLowerCase() === 'lax') {
                return 'lax';
            }

            if (sameSite.toLowerCase() === 'strict') {
                return 'strict';
            }
        }

        return 'no_restriction';
    }
}
