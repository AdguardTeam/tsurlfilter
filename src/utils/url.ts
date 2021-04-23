import { parse } from 'tldts';

/**
 * Removes query params from url by regexp
 *
 * @param url
 * @param regExp
 * @param invert remove every parameter in url except the ones matched regexp
 */
export function cleanUrlParamByRegExp(url: string, regExp: RegExp, invert = false): string {
    const urlPieces = url.split('?');

    // If no params, nothing to modify
    if (urlPieces.length === 1) {
        return url;
    }

    if (invert) {
        urlPieces[1] = urlPieces[1]
            .split('&')
            .filter((x) => x)
            .filter((x) => x && x.match(regExp))
            .join('&');
    } else {
        urlPieces[1] = urlPieces[1]
            .split('&')
            .filter((x) => x)
            .map((x) => (x.includes('=') ? x : `${x}=`))
            .filter((x) => x && !x.match(regExp))
            .map((x) => (x.endsWith('=') ? x.substring(0, x.length - 1) : x))
            .join('&');
    }

    // Cleanup empty params (p0=0&=2&=3)
    urlPieces[1] = urlPieces[1]
        .split('&')
        .filter((x) => x && !x.startsWith('='))
        .join('&');

    // If we've collapsed the URL to the point where there's an '&' against the '?'
    // then we need to get rid of that.
    while (urlPieces[1].charAt(0) === '&') {
        urlPieces[1] = urlPieces[1].substr(1);
    }

    return urlPieces[1] ? urlPieces.join('?') : urlPieces[0];
}

/**
 * Removes query params from url by array of params
 *
 * @param url
 * @param params
 * @param invert use params as exceptions, then it removes all query parameters with the name different from param.
 */
export function cleanUrlParam(url: string, params: string[], invert = false): string {
    const trackingParametersRegExp = new RegExp(`((^|&)(${params.join('|')})=[^&#]*)`, 'ig');
    return cleanUrlParamByRegExp(url, trackingParametersRegExp, invert);
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
