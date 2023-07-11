/* eslint-disable class-methods-use-this */
import browser, { Cookies } from 'webextension-polyfill';

import ParsedCookie from '../parsed-cookie';
import { logger } from '../../../../../common/utils/logger';

import SetDetailsType = Cookies.SetDetailsType;
import SameSiteStatus = Cookies.SameSiteStatus;

/**
 * Cookie api implementation.
 */
export default class BrowserCookieApi {
    /**
     * Removes cookie.
     *
     * @param name Cookie name.
     * @param url Request url.
     * @returns True if cookie was removed.
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
     * Updates cookie.
     *
     * @param cookie Cookie for update.
     */
    async modifyCookie(cookie: ParsedCookie): Promise<boolean> {
        try {
            const update = BrowserCookieApi.convertToSetDetailsType(cookie);
            await browser.cookies.set(update);

            return true;
        } catch (e) {
            // If `domain` contains the `path` part, the cookie cannot be saved,
            // since `domain` can only contain hostname.
            if (cookie.domain?.includes('/')) {
                logger.info((e as Error).message);
            } else {
                logger.error((e as Error).message);
            }
        }

        return false;
    }

    /**
     * Search for cookies that match a given pattern.
     *
     * @param pattern Pattern of cookies to find.
     *
     * @returns List of found cookies.
     */
    async findCookies(pattern: Cookies.GetAllDetailsType): Promise<Cookies.Cookie[]> {
        try {
            const found = await browser.cookies.getAll(pattern);

            return found;
        } catch (e) {
            logger.error((e as Error).message);
        }

        return [];
    }

    /**
     * Converts cookie to SetDetailsType.
     *
     * @param cookie Cookie for convert.
     * @returns SetDetailsType.
     */
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
             */
            name: cookie.name,

            /**
             * The value of the cookie. Empty by default if omitted.
             */
            value: cookie.value,

            /**
             * The domain of the cookie. If omitted, the cookie becomes a host-only cookie.
             */
            domain: cookie.domain,

            /**
             * Whether the cookie should be marked as Secure. Defaults to false.
             */
            secure: cookie.secure,

            /**
             * Whether the cookie should be marked as HttpOnly. Defaults to false.
             */
            httpOnly: cookie.httpOnly,

            /**
             * The cookie's same-site status.
             */
            sameSite: BrowserCookieApi.getSameSiteStatus(cookie.sameSite),

            /**
             * The expiration date of the cookie as the number of seconds since the UNIX epoch.
             * If omitted, the cookie becomes a session cookie.
             */
            expirationDate: cookie.expires
                ? Math.floor(cookie.expires.getTime() / 1000)
                : undefined,

            /**
             * The path of the cookie. Defaults to the path portion of the url parameter.
             */
            path: cookie.path,
        };
    }

    /**
     * Returns same-site type.
     *
     * @param sameSite Same-site string.
     * @returns Same-site status or undefined if same-site is not specified.
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
