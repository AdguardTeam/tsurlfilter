import { parse } from 'tldts';

/**
 * Splits url into parts
 *
 * @param url
 */
function splitUrl(url: string): { path: string; query: string; hash: string } {
    let strippedUrl = url;

    let hash = '';
    const hashIndex = url.indexOf('#');
    if (hashIndex >= 0) {
        hash = url.slice(hashIndex);
        strippedUrl = url.slice(0, hashIndex);
    }

    let query = '';
    const queryIndex = url.indexOf('?');
    if (queryIndex >= 0) {
        query = strippedUrl.slice(queryIndex + 1);
        strippedUrl = strippedUrl.slice(0, queryIndex);
    }

    return {
        path: strippedUrl,
        query,
        hash,
    };
}

/**
 * Normalizes url query parameters
 *
 * @param query
 */
function normalizeQuery(query: string): string {
    // Cleanup empty params (p0=0&=2&=3)
    let result = query
        .split('&')
        .filter((x) => x && !x.startsWith('='))
        .join('&');

    // If we've collapsed the URL to the point where there's an '&' against the '?'
    // then we need to get rid of that.
    while (result.charAt(0) === '&') {
        result = result.substr(1);
    }

    return result;
}

/**
 * Removes query params from url by regexp
 *
 * @param url
 * @param regExp
 * @param invert remove every parameter in url except the ones matched regexp
 */
export function cleanUrlParamByRegExp(url: string, regExp: RegExp, invert = false): string {
    const searchIndex = url.indexOf('?');
    // If no params, nothing to modify
    if (searchIndex === -1) {
        return url;
    }

    const split = splitUrl(url);

    let modifiedQuery;
    if (invert) {
        modifiedQuery = split.query
            .split('&')
            .filter((x) => x)
            .filter((x) => x && x.match(regExp))
            .join('&');
    } else {
        modifiedQuery = split.query
            .split('&')
            .filter((x) => {
                const test = x.includes('=') ? x : `${x}=`;
                return !test.match(regExp);
            })
            .join('&');
    }

    // Do not normalize if regexp is not applied
    if (modifiedQuery === split.query) {
        return url;
    }

    modifiedQuery = normalizeQuery(modifiedQuery);

    let result = split.path;
    if (modifiedQuery) {
        result += `?${modifiedQuery}`;
    }

    return result + split.hash;
}

/**
 * Checks third party relation
 *
 * @param requestUrl
 * @param referrer
 */
export function isThirdPartyRequest(requestUrl: string, referrer: string): boolean {
    const tldResult = parse(requestUrl);
    const sourceTldResult = parse(referrer);

    return tldResult.domain !== sourceTldResult.domain;
}

/**
 * Extract url host
 *
 * @param url
 */
export function getHost(url: string): string|null {
    let firstIdx = url.indexOf('//');
    if (firstIdx === -1) {
        /**
         * It's non hierarchical structured URL (e.g. stun: or turn:)
         * https://tools.ietf.org/html/rfc4395#section-2.2
         * https://tools.ietf.org/html/draft-nandakumar-rtcweb-stun-uri-08#appendix-B
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
 * Removes leading www. from domain
 * @param domain
 */
export const getCroppedDomain = (domain: string): string => {
    if (domain.startsWith('www.')) {
        return domain.substring(4);
    }
    return domain;
};

const DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;

/**
 * Check if the string could be a domain name
 *
 * @param text
 */
export const isDomainName = (text: string): boolean => {
    if (text.indexOf('.') < 0 || text.endsWith('.')) {
        return false;
    }

    return DOMAIN_REGEX.test(text);
};
