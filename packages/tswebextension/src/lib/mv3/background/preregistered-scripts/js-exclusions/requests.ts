import { Request, RequestType } from '@adguard/tsurlfilter';

import { createPreregisteredPageRequest } from '../page-request';
import { getPreregisteredRootUrl } from '../root-request';

/**
 * Requests the scan evaluates for one hostname, built once so a host-less pass
 * does not parse the same URLs per candidate.
 */
export interface HostRequests {
    /**
     * Page of the host used as the request and as its own source: the slot the
     * cosmetic rules are matched in.
     */
    cosmetic: Request;

    /**
     * Root page used as a request without a source: the second slot the JS bit
     * depends on (`Engine.matchFrame()`).
     */
    document: Request;

    /**
     * Root pages a host-less exception can match, one per document scheme.
     */
    rootPages: readonly Request[];
}

/**
 * Builds the requests one hostname is evaluated with.
 *
 * @param hostname Hostname of the registration.
 *
 * @returns Requests of the host.
 */
export const createHostRequests = (hostname: string): HostRequests => {
    const document = new Request(getPreregisteredRootUrl(hostname), '', RequestType.Document);

    return {
        cosmetic: createPreregisteredPageRequest(hostname),
        document,
        rootPages: [document, new Request(`http://${hostname}/`, '', RequestType.Document)],
    };
};
