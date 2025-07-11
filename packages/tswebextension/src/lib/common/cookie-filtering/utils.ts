import browser from 'webextension-polyfill';

import { logger } from '../utils/logger';

import { ParsedCookie } from './parsed-cookie';
import HttpHeadersItemType = browser.WebRequest.HttpHeadersItemType;

/**
 * Cookie Utils.
 */
export class CookieUtils {
    /**
     * RegExp to match field-content in RFC 7230 sec 3.2.
     *
     * Example:
     * field-content = field-vchar [ 1*( SP / HTAB ) field-vchar ]
     * field-vchar   = VCHAR / obs-text
     * obs-text      = %x80-FF.
     */
    // eslint-disable-next-line no-control-regex
    static FIELD_CONTENT_REGEX = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;

    /**
     * Parses set-cookie header from http response header.
     *
     * @param header HTTP response header.
     * @param url Request URL.
     *
     * @returns Parsed cookie or null if it failed to parse the header.
     */
    static parseSetCookieHeader(header: HttpHeadersItemType, url: string): ParsedCookie | null {
        if (!header.name || header.name.toLowerCase() !== 'set-cookie') {
            return null;
        }

        if (!header.value) {
            return null;
        }

        return CookieUtils.parseSetCookie(header.value, url);
    }

    /**
     * Parses set-cookie headers for cookie objects.
     *
     * @param responseHeaders HTTP response headers.
     * @param url Request URL.
     *
     * @returns Array of parsed cookies.
     */
    static parseSetCookieHeaders(responseHeaders: HttpHeadersItemType[], url: string): ParsedCookie[] {
        const result = [];
        let iResponseHeaders = responseHeaders.length;
        while (iResponseHeaders > 0) {
            iResponseHeaders -= 1;
            const header = responseHeaders[iResponseHeaders];

            const setCookie = CookieUtils.parseSetCookieHeader(header, url);

            if (setCookie) {
                result.push(setCookie);
            }
        }

        return result;
    }

    /**
     * Parse an HTTP Cookie header string and return an object with all cookie name-value pairs.
     *
     * @param cookieValue HTTP Cookie value.
     * @param url Request URL.
     *
     * @returns Array of cookie name-value pairs.
     */
    static parseCookies(cookieValue: string, url: string): ParsedCookie[] {
        const cookies = [];

        // Split Cookie values
        const pairs = cookieValue.split(/; */);

        for (let i = 0; i < pairs.length; i += 1) {
            const pair = pairs[i];
            const eqIdx = pair.indexOf('=');

            // skip things that don't look like key=value
            if (eqIdx < 0) {
                continue;
            }

            const key = pair.substring(0, eqIdx).trim();
            const value = pair.substring(eqIdx + 1, pair.length).trim();

            const parsedCookie = new ParsedCookie(key, value, url);
            /**
             * Not obviously there are few special name prefixes.
             *
             * @see {@link https://developer.cdn.mozilla.net/pt-BR/docs/Web/HTTP/Headers/Set-Cookie}
             */
            if (key.startsWith('__Secure-') || key.startsWith('__Host-')) {
                parsedCookie.secure = true;
            }

            cookies.push(parsedCookie);
        }

        return cookies;
    }

    /**
     * Parses "Set-Cookie" header value and returns a cookie object with its properties.
     *
     * @param setCookieValue "Set-Cookie" header value to parse.
     * @param url Request URL.
     *
     * @returns Parsed cookie or null if it failed to parse the value.
     */
    static parseSetCookie(setCookieValue: string, url: string): ParsedCookie | null {
        const parts = setCookieValue.split(';').filter((s) => !!s);
        const nameValuePart = parts.shift();
        if (!nameValuePart) {
            logger.debug(`[tsweb.CookieUtils.parseSetCookie]: cannot shift first name-value pair from Set-Cookie header '${setCookieValue}'.`);
            return null;
        }

        const nameValue = nameValuePart.split('=');
        const name = nameValue.shift();
        if (!name) {
            logger.debug(`[tsweb.CookieUtils.parseSetCookie]: cannot extract name from first name-value pair from Set-Cookie header '${setCookieValue}'.`);
            return null;
        }
        // Everything after the first =, joined by a "=" if there was more
        // than one part.
        const value = nameValue.join('=');
        const cookie = new ParsedCookie(name, value, url);

        parts.forEach((part) => {
            const sides = part.split('=');
            const key = sides
                .shift()!
                .trimStart()
                .toLowerCase();
            const optionValue = sides.join('=');
            if (key === 'expires') {
                cookie.expires = new Date(optionValue);
            } else if (key === 'max-age') {
                cookie.maxAge = parseInt(optionValue, 10);
            } else if (key === 'secure') {
                cookie.secure = true;
            } else if (key === 'httponly') {
                cookie.httpOnly = true;
            } else if (key === 'samesite') {
                cookie.sameSite = optionValue;
            } else if (key === 'path') {
                cookie.path = optionValue;
            } else if (key === 'domain') {
                cookie.domain = optionValue;
            }
        });

        return cookie;
    }

    /**
     * Updates cookie maxAge value.
     *
     * @param cookie Cookie to modify.
     * @param maxAge New maxAge value.
     *
     * @returns True if cookie was modified.
     */
    static updateCookieMaxAge(cookie: ParsedCookie, maxAge: number): boolean {
        const currentTimeSec = Date.now() / 1000;

        let cookieExpiresTimeSec = null;
        if (cookie.maxAge) {
            cookieExpiresTimeSec = currentTimeSec + cookie.maxAge;
        } else if (cookie.expires) {
            cookieExpiresTimeSec = cookie.expires.getTime() / 1000;
        }

        const newCookieExpiresTimeSec = currentTimeSec + maxAge;
        if (cookieExpiresTimeSec === null || cookieExpiresTimeSec > newCookieExpiresTimeSec) {
            // eslint-disable-next-line no-param-reassign
            cookie.expires = new Date(newCookieExpiresTimeSec * 1000);
            // eslint-disable-next-line no-param-reassign
            cookie.maxAge = maxAge;

            return true;
        }

        return false;
    }

    /**
     * Serializes cookie data into a string suitable for Set-Cookie header.
     *
     * @param cookie A cookie object.
     *
     * @returns Set-Cookie string or null if it failed to serialize object.
     *
     * @throws `TypeError` if input data is invalid.
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
     *
     * @returns Cookie string or null if it failed to serialize object.
     */
    static serializeCookieToRequestHeader(cookies: ParsedCookie[]): string {
        return cookies
            .map((cookie) => `${cookie.name}=${cookie.value}`)
            .join('; ');
    }
}
