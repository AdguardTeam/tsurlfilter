import { type WebRequest } from 'webextension-polyfill';

import { type ParsedCookie } from '../../../../common/cookie-filtering/parsed-cookie';
import { CookieUtils as CommonCookieUtils } from '../../../../common/cookie-filtering/utils';

// TODO: use named export
/**
 * Cookie Utils.
 */
export default class CookieUtils extends CommonCookieUtils {
    /**
     * Set-Cookie header name.
     */
    private static SET_COOKIE_HEADER_NAME = 'set-cookie';

    /**
     * Line feed character.
     */
    private static LINE_FEED = '\n';

    /**
     * Splits a single `set-cookie` header with multiline cookies into
     * multiple `set-cookie` headers with single-line cookies.
     *
     * Mutates `responseHeaders`.
     *
     * @param responseHeaders HTTP response headers.
     */
    static splitMultilineCookies(responseHeaders: WebRequest.HttpHeaders): void {
        for (let i = responseHeaders.length - 1; i >= 0; i -= 1) {
            const { name, value } = responseHeaders[i];
            if (name.toLowerCase() !== CookieUtils.SET_COOKIE_HEADER_NAME
                || !value
                || !value.includes(CookieUtils.LINE_FEED)) {
                continue;
            }

            const values = value.split(CookieUtils.LINE_FEED);

            // Remove the original header, iteration won't be broken
            // as the array is being modified from the end
            responseHeaders.splice(i, 1);

            // eslint-disable-next-line @typescript-eslint/no-shadow
            values.forEach((value) => {
                responseHeaders.push({ name: CookieUtils.SET_COOKIE_HEADER_NAME, value });
            });
        }
    }

    /**
     * Serializes cookie data into a string suitable for Set-Cookie header.
     *
     * @param cookie A cookie object.
     * @returns Set-Cookie string or null if it failed to serialize object.
     * @throws {TypeError} Thrown in case of invalid input data.
     */
    static serializeCookieToResponseHeader(cookie: ParsedCookie): string {
        if (!cookie) {
            throw new TypeError('empty cookie data');
        }

        // 1. Validate fields
        if (!CookieUtils.FIELD_CONTENT_REGEX.test(cookie.name)) {
            throw new TypeError(`Cookie name is invalid: ${cookie.name}`);
        }
        if (cookie.value && !CookieUtils.FIELD_CONTENT_REGEX.test(cookie.value)) {
            throw new TypeError(`Cookie value is invalid: ${cookie.value}`);
        }
        if (cookie.domain && !CookieUtils.FIELD_CONTENT_REGEX.test(cookie.domain)) {
            throw new TypeError(`Cookie domain is invalid: ${cookie.domain}`);
        }
        if (cookie.path && !CookieUtils.FIELD_CONTENT_REGEX.test(cookie.path)) {
            throw new TypeError(`Cookie path is invalid: ${cookie.path}`);
        }
        if (cookie.expires && typeof cookie.expires.toUTCString !== 'function') {
            throw new TypeError(`Cookie expires is invalid: ${cookie.expires}`);
        }

        // 2. Build Set-Cookie header value
        let setCookieValue = `${cookie.name}=${cookie.value}`;

        if (typeof cookie.maxAge === 'number' && !Number.isNaN(cookie.maxAge)) {
            setCookieValue += `; Max-Age=${Math.floor(cookie.maxAge)}`;
        }
        if (cookie.domain) {
            setCookieValue += `; Domain=${cookie.domain}`;
        }
        if (cookie.path) {
            setCookieValue += `; Path=${cookie.path}`;
        }
        if (cookie.expires) {
            setCookieValue += `; Expires=${cookie.expires.toUTCString()}`;
        }
        if (cookie.httpOnly) {
            setCookieValue += '; HttpOnly';
        }
        if (cookie.secure) {
            setCookieValue += '; Secure';
        }
        if (cookie.sameSite) {
            const sameSite = cookie.sameSite.toLowerCase();

            switch (sameSite) {
                case 'lax':
                    setCookieValue += '; SameSite=Lax';
                    break;
                case 'strict':
                    setCookieValue += '; SameSite=Strict';
                    break;
                case 'none':
                    setCookieValue += '; SameSite=None';
                    break;
                default:
                    throw new TypeError(`Cookie sameSite is invalid: ${cookie.sameSite}`);
            }
        }

        // Not affected. Let it be here just in case
        // https://bugs.chromium.org/p/chromium/issues/detail?id=232693
        if (cookie.priority) {
            setCookieValue += `; Priority=${cookie.priority}`;
        }

        return setCookieValue;
    }

    /**
     * Serializes cookie data into a string suitable for Cookie header.
     *
     * @param cookies Array with {@link ParsedCookie}.
     * @returns Cookie string or null if it failed to serialize object.
     */
    static serializeCookieToRequestHeader(cookies: ParsedCookie[]): string {
        return cookies
            .map((cookie) => `${cookie.name}=${cookie.value}`)
            .join('; ');
    }
}
