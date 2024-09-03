import { WebRequest } from 'webextension-polyfill';
import ParsedCookie from './parsed-cookie';
import HttpHeadersItemType = WebRequest.HttpHeadersItemType;
/**
 * Cookie Utils
 */
export default class CookieUtils {
    /**
     * RegExp to match field-content in RFC 7230 sec 3.2
     *
     * field-content = field-vchar [ 1*( SP / HTAB ) field-vchar ]
     * field-vchar   = VCHAR / obs-text
     * obs-text      = %x80-FF
     */
    static FIELD_CONTENT_REGEX: RegExp;
    /**
     * Parses set-cookie header from http response header
     * @param header
     * @param url
     */
    static parseSetCookieHeader(header: HttpHeadersItemType, url: string): ParsedCookie | null;
    /**
     * Parses set-cookie headers for cookie objects
     *
     * @param responseHeaders
     * @param url
     * @returns array of parsed cookies
     */
    static parseSetCookieHeaders(responseHeaders: HttpHeadersItemType[], url: string): ParsedCookie[];
    /**
     * Parse an HTTP Cookie header string and return an object with all cookie name-value pairs.
     *
     * @param cookieValue HTTP Cookie value
     * @param url
     * @returns Array of cookie name-value pairs
     */
    static parseCookies(cookieValue: string, url: string): ParsedCookie[];
    /**
     * Parses "Set-Cookie" header value and returns a cookie object with its properties
     *
     * @param setCookieValue "Set-Cookie" header value to parse
     * @param url
     * @returns cookie object or null if it failed to parse the value
     */
    static parseSetCookie(setCookieValue: string, url: string): ParsedCookie | null;
    /**
     * Updates cookie maxAge value
     *
     * @param cookie Cookie to modify
     * @param maxAge
     * @return if cookie was modified
     */
    static updateCookieMaxAge(cookie: ParsedCookie, maxAge: number): boolean;
    /**
     * Serializes cookie data into a string suitable for Set-Cookie header.
     *
     * @param cookie A cookie object
     * @return Set-Cookie string or null if it failed to serialize object
     * @throws {TypeError} Thrown in case of invalid input data
     * @public
     */
    static serializeCookie(cookie: ParsedCookie): string;
}
