import { Request, RequestType } from '@adguard/tsurlfilter';

import { getPreregisteredRootUrl } from './root-request';

/**
 * Creates the document request a host's JS verdict is decided on: the link is
 * the page itself, so the request is first-party and its source hostname is
 * the page hostname.
 *
 * Modifier matching needs both: `matchModifiers()` resolves a `$domain` of a
 * domain-specific pattern against the source hostname for document requests,
 * and a request without a source has none.
 *
 * It stays out of the public entries because nothing outside the package
 * imports it, unlike the root URL helpers next to it.
 *
 * @param hostname Hostname to query.
 *
 * @returns Document request of the hostname page.
 */
export const createPreregisteredPageRequest = (hostname: string): Request => {
    const url = getPreregisteredRootUrl(hostname);

    return new Request(url, url, RequestType.Document);
};
