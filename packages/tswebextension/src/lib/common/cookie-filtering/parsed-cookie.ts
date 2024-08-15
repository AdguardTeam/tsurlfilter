import { type Cookies } from 'webextension-polyfill';

/**
 * Synthetic Cookie-like object parsed from headers.
 */
export class ParsedCookie {
    /**
     * The request-URI to associate with the setting of the cookie.
     */
    url: string;

    /**
     * Defines the host to which the cookie will be sent.
     * Only the current domain can be set as the value, or a domain of a higher
     * order, unless it is a public suffix. Setting the domain will make
     * the cookie available to it, as well as to all its subdomains.
     *
     * Can be empty. And actually should be empty for `__Host-` cookies.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes}
     */
    domain?: string;

    /**
     * The name of the cookie.
     */
    name: string;

    /**
     * The value of the cookie.
     */
    value: string;

    /**
     * The expiration date of the cookie.
     */
    expires?: Date;

    /**
     * The parsed max-age value in seconds.
     */
    maxAge?: number;

    /**
     * True if the cookie is marked as Secure.
     */
    secure?: boolean;

    /**
     * Whether the cookie should be marked as HttpOnly.
     */
    httpOnly?: boolean;

    /**
     * Cookie's same-site status.
     */
    sameSite?: string;

    /**
     * Cookies path. Defaults to the path portion of the url parameter.
     */
    path?: string;

    /**
     * Priority chrome only specs.
     * Isn't affected. Let it be here just in case.
     *
     * @see {@link https://bugs.chromium.org/p/chromium/issues/detail?id=232693}
     */
    priority?: string;

    /**
     * Cookie's third-party status.
     */
    thirdParty = false;

    /**
     * Constructor.
     *
     * @param name Cookie name.
     * @param value Cookie value.
     * @param url Url.
     */
    constructor(name: string, value: string, url: string) {
        this.name = name;
        this.value = value;

        this.url = url;
        this.path = new URL(url).pathname;
    }

    /**
     * Creates new {@link ParsedCookie} from provided {@link Cookies.Cookie}.
     *
     * @param cookie Item of {@link Cookies.Cookie}.
     * @param url String URL relative to this cookie.
     *
     * @returns New {@link ParsedCookie}.
     */
    static fromBrowserCookie(cookie: Cookies.Cookie, url: string): ParsedCookie {
        const parsedCookie = new ParsedCookie(cookie.name, cookie.value, url);

        parsedCookie.thirdParty = !cookie.firstPartyDomain;
        parsedCookie.httpOnly = cookie.httpOnly;
        parsedCookie.secure = cookie.secure;
        parsedCookie.sameSite = cookie.sameSite;

        // For hostOnly cookie domain should be empty and path should be '/'.
        if (cookie.hostOnly) {
            parsedCookie.path = '/';
        } else {
            parsedCookie.domain = cookie.domain;
            parsedCookie.path = cookie.path;
        }

        if (cookie.expirationDate) {
            // cookie.expirationDate is a number of seconds that's why it should be multiplied
            parsedCookie.expires = new Date(cookie.expirationDate * 1000);
        }

        return parsedCookie;
    }
}
