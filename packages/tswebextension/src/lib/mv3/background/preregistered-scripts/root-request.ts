import { Request, RequestType } from '@adguard/tsurlfilter';

/**
 * Root URL of a hostname: the synthetic request target that both the
 * build-time preregistration tools and the runtime sync-time checks must
 * query, so the two sides share this helper instead of building the URL on
 * their own.
 *
 * @param hostname Hostname string.
 *
 * @returns Root URL string: `https://hostname/`.
 */
export const getPreregisteredRootUrl = (hostname: string): string => {
    return `https://${hostname}/`;
};

/**
 * Creates the synthetic root document request for a hostname.
 *
 * @param hostname Hostname to query.
 *
 * @returns Root document request for the hostname.
 */
export const createPreregisteredRootRequest = (hostname: string): Request => {
    return new Request(getPreregisteredRootUrl(hostname), null, RequestType.Document);
};
