import { parse } from 'tldts';
import browser from 'webextension-polyfill';

/**
 * Checks if url is http request.
 *
 * @param url Request url.
 * @returns True if url starts with http{s?}.
 */
export function isHttpRequest(url: unknown): boolean {
    return typeof url === 'string' && !!url && url.indexOf('http') === 0;
}

/**
 * Checks if url is http or websocket.
 *
 * @param url Request url.
 * @returns True if url starts with http{s?} or ws.
 */
export function isHttpOrWsRequest(url: string): boolean {
    return !!url && (url.indexOf('http') === 0 || url.indexOf('ws') === 0);
}

/**
 * Extract host from url.
 *
 * @param url Url.
 * @returns Host of the url or null.
 */
export function getHost(url: string): string | null {
    let firstIdx = url.indexOf('//');
    if (firstIdx === -1) {
        /**
         * It's non-hierarchical structured URL (stun: or turn:).
         *
         * @see {@link https://tools.ietf.org/html/rfc4395#section-2.2}
         * @see {@link https://tools.ietf.org/html/draft-nandakumar-rtcweb-stun-uri-08#appendix-B}
         */
        firstIdx = url.indexOf(':');
        if (firstIdx === -1) {
            return null;
        }
        firstIdx -= 1;
    }

    const nextSlashIdx = url.indexOf('/', firstIdx + 2);
    const startParamsIdx = url.indexOf('?', firstIdx + 2);

    let lastIdx = nextSlashIdx;
    if (startParamsIdx > 0 && (startParamsIdx < nextSlashIdx || nextSlashIdx < 0)) {
        lastIdx = startParamsIdx;
    }

    let host = lastIdx === -1 ? url.substring(firstIdx + 2) : url.substring(firstIdx + 2, lastIdx);

    const portIndex = host.indexOf(':');

    host = portIndex === -1 ? host : host.substring(0, portIndex);
    const lastChar = host.charAt(host.length - 1);
    if (lastChar === '.') {
        host = host.slice(0, -1);
    }

    return host;
}

/**
 * Extracts domain name from url.
 *
 * @param url Url.
 * @returns Domain name or null.
 */
export function getDomain(url: string): string | null {
    const host = getHost(url);
    if (!host) {
        return null;
    }

    return host.startsWith('www.') ? host.substring(4) : host;
}

/**
 * If referrer of request contains full url of extension, then this request is considered as extension's own request.
 * Example: request for filter downloading.
 * Related issue: @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1437}.
 *
 * @param url Request url.
 * @returns True if request is extension's own.
 */
export function isExtensionUrl(url: string): boolean {
    return url.indexOf(browser.runtime.getURL('')) === 0;
}

/**
 * Checks third party relation.
 *
 * @param requestUrl Request url.
 * @param referrer Referrer url.
 * @returns True if request is third-party.
 */
export function isThirdPartyRequest(requestUrl: string, referrer: string): boolean {
    const tldResult = parse(requestUrl);
    const sourceTldResult = parse(referrer);

    return tldResult.domain !== sourceTldResult.domain;
}
