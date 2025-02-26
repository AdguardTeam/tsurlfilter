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

/**
 * See {@link https://developer.chrome.com/docs/web-platform/prerender-pages#how_is_a_page_prerendered}.
 */
export enum DocumentLifecycle {
    Prerender = 'prerender',
    Active = 'active',
    Cached = 'cached',
    PendingDeletion = 'pending_deletion',
}
