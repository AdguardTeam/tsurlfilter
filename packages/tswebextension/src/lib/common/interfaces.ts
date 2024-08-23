import { type HTTPMethod, type NetworkRule, type RequestType } from '@adguard/tsurlfilter';

/**
 * Request Match Query.
 */
export interface MatchQuery {
    requestUrl: string;
    frameUrl: string;
    requestType: RequestType;
    frameRule?: NetworkRule | null;
    method?: HTTPMethod;
}
