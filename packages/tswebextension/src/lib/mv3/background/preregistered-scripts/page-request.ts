import { Request, RequestType } from '@adguard/tsurlfilter';

import { getPreregisteredRootUrl } from './root-request';

/**
 * Creates the document request the page gate decides on: the link is the page
 * itself, so the request is first-party and its source hostname is the page
 * hostname.
 *
 * Modifier matching needs both: `matchModifiers()` resolves a `$domain` of a
 * domain-specific pattern against the source hostname for document requests,
 * and a request without a source has none.
 *
 * Runtime-only, unlike the public `root-request` entry: the build tools never
 * decide a page, they only query a host.
 *
 * @param hostname Hostname to query.
 *
 * @returns Document request of the hostname page.
 */
export const createPreregisteredPageRequest = (hostname: string): Request => {
    const url = getPreregisteredRootUrl(hostname);

    return new Request(url, url, RequestType.Document);
};
