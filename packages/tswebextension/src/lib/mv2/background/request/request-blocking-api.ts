import { WebRequest } from 'webextension-polyfill';
import { RequestType, NetworkRuleOption, NetworkRule } from '@adguard/tsurlfilter';
import { engineApi } from '../engine-api';
import { redirectsService } from '../services/redirects-service';
import { tabsApi } from '../tabs';

export type WebRequestBlockingResponse = WebRequest.BlockingResponse | void;

export class RequestBlockingApi {
    public static processShouldCollapse(
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

        return RequestBlockingApi.isRequestBlockedByRule(result.getBasicResult());
    }

    public static isRequestBlockedByRule(requestRule: NetworkRule | null): boolean {
        return !!requestRule
            && !requestRule.isAllowlist()
            && !requestRule.isOptionEnabled(NetworkRuleOption.Replace)
            && !requestRule.isOptionEnabled(NetworkRuleOption.Redirect);
    }

    public static isDocumentBlockingRule(requestRule: NetworkRule | null): boolean {
        return !!requestRule
            && !requestRule.isAllowlist()
            && requestRule.isOptionEnabled(NetworkRuleOption.Document);
    }

    public static isPopupBlockingRule(requestRule: NetworkRule | null): boolean {
        return !!requestRule
            && !requestRule.isAllowlist()
            && requestRule.isOptionEnabled(NetworkRuleOption.Popup);
    }

    public static getRule(
        requestRule: NetworkRule | null,
        requestType: RequestType,
    ) {
        // Don't block main_frame request
        if (RequestBlockingApi.isRequestBlockedByRule(requestRule)
            && requestType === RequestType.Document
        ) {
            return null;
        }

        //
        if (requestRule?.isOptionEnabled(NetworkRuleOption.Replace)) {
            return null;
        }

        return requestRule;
    }

    static postProcessRequestRule(
        requestRule: NetworkRule | null,
        requestType: RequestType,
    ) {
        if (requestRule && !requestRule.isAllowlist()) {
            const isRequestBlockingRule = RequestBlockingApi.isRequestBlockedByRule(requestRule);
            const isReplaceRule = requestRule.isOptionEnabled(NetworkRuleOption.Replace);

            // Url blocking rules are not applicable to the main_frame
            if (isRequestBlockingRule && requestType === RequestType.Document) {
                // except rules with $document and $popup modifiers
                if (!RequestBlockingApi.isDocumentBlockingRule(requestRule)
                    && !RequestBlockingApi.isPopupBlockingRule(requestRule)) {
                    return null;
                }
            }

            // Replace rules are processed in content-filtering
            if (isReplaceRule) {
                return null;
            }
        }

        return requestRule;
    }

    public static getBlockedResponseByRule(requestRule: NetworkRule | null): WebRequestBlockingResponse {
        if (RequestBlockingApi.isRequestBlockedByRule(requestRule)) {
            return { cancel: true };
        }

        // check if request rule is blocked by rule and is redirect rule
        if (requestRule && !requestRule.isAllowlist()) {
            if (requestRule.isOptionEnabled(NetworkRuleOption.Redirect)) {
                const redirectUrl = redirectsService.createRedirectUrl(requestRule.getAdvancedModifierValue());
                if (redirectUrl) {
                    return { redirectUrl };
                }
            }
        }
    }
}
