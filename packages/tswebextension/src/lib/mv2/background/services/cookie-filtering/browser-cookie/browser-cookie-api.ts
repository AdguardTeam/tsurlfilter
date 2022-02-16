/* istanbul ignore file */
/* eslint-disable class-methods-use-this */
import browser, { Cookies } from 'webextension-polyfill';
import { logger } from '@adguard/tsurlfilter';
import ParsedCookie from '../parsed-cookie';
import SetDetailsType = Cookies.SetDetailsType;
import SameSiteStatus = Cookies.SameSiteStatus;

/**
 * Cookie api implementation
 */
export default class BrowserCookieApi {
    /**
     * Removes cookie
     *
     * @param name
     * @param url
     */
    async removeCookie(name: string, url: string): Promise<boolean> {
        try {
            await browser.cookies.remove({ name, url });
            return true;
        } catch (e) {
            logger.error((e as Error).message);
        }

        return false;
    }

    /**
     * Updates cookie
     *
     * @param cookie Cookie for update
     */
    async modifyCookie(cookie: ParsedCookie): Promise<boolean> {
        try {
            const update = BrowserCookieApi.convertToSetDetailsType(cookie);
            await browser.cookies.set(update);

            return true;
        } catch (e) {
            logger.error((e as Error).message);
        }

        return false;
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
        };
    }

    /**
     * Returns same-site type
     *
     * @param sameSite
     */
    private static getSameSiteStatus(sameSite: string | undefined): SameSiteStatus | undefined {
        if (sameSite) {
            if (sameSite.toLowerCase() === 'lax') {
                return 'lax';
            }

            if (sameSite.toLowerCase() === 'strict') {
                return 'strict';
            }
        }

        return undefined;
    }
}
