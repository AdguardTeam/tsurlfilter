import { parse } from 'tldts';

/**
 * Synthetic Cookie-like object parsed from headers
 */
export default class ParsedCookie {
    /**
     * The request-URI to associate with the setting of the cookie.
     */
    url: string;

    /**
     * The domain of the cookie.
     */
    domain: string;

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
     * The parsed max-age value.
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
     * Cookies path
     */
    path?: string;

    /**
     * Priority chrome only specs
     * Don't affected. Let it be here just in case
     * https://bugs.chromium.org/p/chromium/issues/detail?id=232693
     */
    priority?: string;

    /**
     * Cookie's third-party status.
     */
    thirdParty = false;

    /**
     * Constructor
     *
     * @param name
     * @param value
     * @param url
     */
    constructor(name: string, value: string, url: string) {
        this.name = name;
        this.value = value;

        this.url = url;
        const tldResult = parse(url);
        this.domain = tldResult.domain!;
    }
}
