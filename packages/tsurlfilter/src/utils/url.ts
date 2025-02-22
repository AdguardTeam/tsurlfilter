/**
 * Splits url into parts.
 *
 * @param url The URL to be checked.
 *
 * @returns An object containing the path, query, and hash of the URL.
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
 * Normalizes url query parameters.
 *
 * @param query The query string to be normalized.
 *
 * @returns The normalized query string.
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
        result = result.slice(1);
    }

    return result;
}

/**
 * Removes query params from url by regexp.
 *
 * @param url The URL from which query parameters will be removed.
 * @param regExp The regular expression to match query parameters.
 * @param invert Remove every parameter in url except the ones matched regexp.
 *
 * @returns The URL with the specified query parameters removed.
 */
export function cleanUrlParamByRegExp(url: string, regExp: RegExp, invert = false): string {
    const searchIndex = url.indexOf('?');
    // If no params, nothing to modify
    if (searchIndex === -1) {
        return url;
    }

    const split = splitUrl(url);

    /**
     * We are checking both regular param and decoded param, in case if regexp
     * contains decoded params and url contains encoded params.
     *
     * @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3015}
     */
    let modifiedQuery;
    if (invert) {
        modifiedQuery = split.query
            .split('&')
            .filter((x) => x && (x.match(regExp) || decodeURIComponent(x).match(regExp)))
            .join('&');
    } else {
        modifiedQuery = split.query
            .split('&')
            .filter((x) => {
                const test = x.includes('=') ? x : `${x}=`;
                return !test.match(regExp) && !decodeURIComponent(test).match(regExp);
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
 * Extract relative part from hierarchical structured URL.
 *
 * @param url The URL from which the relative part will be extracted.
 *
 * @returns The relative part of the URL or null if not found.
 */
export const getRelativeUrl = (url: string): string | null => {
    const i = url.indexOf('/', url.indexOf('://') + 3);
    return i !== -1 ? url.slice(i) : null;
};

/**
 * Checks if url is http or websocket.
 *
 * @param url Request url.
 *
 * @returns True if url starts with http{s?} or ws.
 */
export function isHttpOrWsRequest(url: string): boolean {
    return !!url && (url.startsWith('http') || url.startsWith('ws'));
}
