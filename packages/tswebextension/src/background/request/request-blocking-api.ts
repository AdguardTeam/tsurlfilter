import { WebRequest } from 'webextension-polyfill';
import { RequestType, NetworkRuleOption, NetworkRule } from '@adguard/tsurlfilter';
import { engineApi } from '../engine-api';
import { redirectsService } from '../services/redirects-service';
import { tabsApi } from '../tabs';

export type WebRequestBlockingResponse = WebRequest.BlockingResponse | void;
export interface RequestBlockingApiInterface {
    processShouldCollapse: (
        tabId: number,
        url: string,
        referrerUrl: string,
        requestType: RequestType
    ) => boolean;

    isRequestBlockedByRule: (
        requestRule: NetworkRule | null
    ) => boolean;

    isDocumentBlockingRule: (
        requestRule: NetworkRule | null
    ) => boolean;

    getBlockedResponseByRule: (
        requestRule: NetworkRule | null,
        requestType: RequestType,
    ) => WebRequestBlockingResponse;
}

export class RequestBlockingApi implements RequestBlockingApiInterface {
    public processShouldCollapse(
        tabId: number,
        url: string,
        referrerUrl: string,
        requestType: RequestType,
    ): boolean {

        const result = engineApi.matchRequest({
            requestUrl: url,
            frameUrl: referrerUrl,
            requestType,
            frameRule: tabsApi.getTabFrameRule(tabId),
        });

        if (!result) {
            return false;
        }

        return this.isRequestBlockedByRule(result.getBasicResult());
    }

    public isRequestBlockedByRule(requestRule: NetworkRule | null): boolean {
        return !!requestRule
            && !requestRule.isAllowlist()
            && !requestRule.isOptionEnabled(NetworkRuleOption.Replace)
            && !requestRule.isOptionEnabled(NetworkRuleOption.Redirect);
    }

    public isDocumentBlockingRule(requestRule: NetworkRule | null): boolean {
        return !!requestRule
            && !requestRule.isAllowlist()
            && requestRule.isOptionEnabled(NetworkRuleOption.Elemhide)
            && requestRule.isOptionEnabled(NetworkRuleOption.Jsinject)
            && requestRule.isOptionEnabled(NetworkRuleOption.Urlblock);
    }

    public getBlockedResponseByRule(
        requestRule: NetworkRule | null,
        requestType: RequestType,
    ): WebRequestBlockingResponse {
        if (this.isRequestBlockedByRule(requestRule)) {
            const isDocumentLevel = requestType === RequestType.Document
                || requestType === RequestType.Subdocument;

            if (isDocumentLevel && this.isDocumentBlockingRule(requestRule)) {
                // TODO: redirect to blocking page
                // TODO: trusted domains cache
                return { cancel: true };
            }

            // Don't block main_frame request
            if (requestType !== RequestType.Document) {
                return { cancel: true };
            }

        // check if request rule is blocked by rule and is redirect rule
        } else if (requestRule && !requestRule.isAllowlist()) {
            if (requestRule.isOptionEnabled(NetworkRuleOption.Redirect)) {
                const redirectUrl = redirectsService.createRedirectUrl(requestRule.getAdvancedModifierValue());
                if (redirectUrl) {
                    return { redirectUrl };
                }
            }
        }

        return;
    }
}

export const requestBlockingApi = new RequestBlockingApi();
