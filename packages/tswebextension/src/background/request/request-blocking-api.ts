import { RequestType, NetworkRuleOption, NetworkRule } from '@adguard/tsurlfilter';
import { engineApi } from '../engine-api';
import { tabsApi } from '../tabs';

export interface RequestBlockingApiInterface {
    processShouldCollapse: (
        tabId: number, 
        url: string, 
        referrerUrl: string, 
        requestType: RequestType
    ) => boolean;
}

export class RequestBlockingApi implements  RequestBlockingApiInterface{
    public processShouldCollapse(
        tabId: number,
        url: string,
        referrerUrl: string,
        requestType: RequestType,
    ): boolean{

        const result = engineApi.matchRequest({
            requestUrl: url,
            frameUrl: referrerUrl,
            requestType,
            frameRule: tabsApi.getTabFrameRule(tabId),
        });

        if (!result){
            return false;
        }

        return this.isRequestBlockedByRule(result.getBasicResult());
    }

    public isRequestBlockedByRule(requestRule: NetworkRule | null){
        return !!requestRule
        && !requestRule.isAllowlist()
        && !requestRule.isOptionEnabled(NetworkRuleOption.Replace)
        && !requestRule.isOptionEnabled(NetworkRuleOption.Redirect);
    }
}

export const requestBlockingApi = new RequestBlockingApi();