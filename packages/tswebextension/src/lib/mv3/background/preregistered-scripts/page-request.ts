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
 * Shared by the page gate and by the build: `computePageExceptionsFingerprint()`
 * decides which exceptions a host's page depends on with the same request, so
 * both sides read the modifiers the same way. It stays out of the public
 * entries because nothing outside the package imports it, unlike the root URL
 * helpers next to it.
 *
 * @param hostname Hostname to query.
 *
 * @returns Document request of the hostname page.
 */
export const createPreregisteredPageRequest = (hostname: string): Request => {
    const url = getPreregisteredRootUrl(hostname);

    return new Request(url, url, RequestType.Document);
};
