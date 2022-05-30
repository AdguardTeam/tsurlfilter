import { NetworkRule, RemoveParamModifier } from '@adguard/tsurlfilter';
import { FilteringLog, defaultFilteringLog, FilteringEventType } from '../../../common';
import { requestContextStorage } from '../request';

/**
 * Params filtering service module
 */
export class ParamsService {
    private filteringLog: FilteringLog;

    /**
     * Constructor
     *
     * @param filteringLog
     */
    constructor(filteringLog: FilteringLog) {
        this.filteringLog = filteringLog;
    }

    private static SupportedMethods = ['GET', 'OPTIONS', 'HEAD'];

    /**
     * Removes request params from url, stored in request context
     *
     * @param requestId
     * @return modified url or null
     */
    public getPurgedUrl(requestId: string): string | null {
        const context = requestContextStorage.get(requestId);

        if (!context) {
            return null;
        }

        const { matchingResult, method, requestUrl } = context;

        if (!matchingResult
            || !requestUrl
            || !method
            || !ParamsService.isMethodSupported(method)
        ) {
            return null;
        }

        const removeParamRules = matchingResult.getRemoveParamRules();

        if (removeParamRules.length === 0) {
            return null;
        }

        const purgedUrl = removeParamRules.reduce((url: string, rule: NetworkRule): string => {
            if (rule.isAllowlist()) {
                return url;
            }

            const modifier = rule.getAdvancedModifier() as RemoveParamModifier;

            const modifiedUrl = modifier.removeParameters(url);

            if (url !== modifiedUrl) {
                this.filteringLog.publishEvent({
                    type: FilteringEventType.REMOVE_PARAM,
                    data: {
                        tabId: context.tabId,
                        frameUrl: modifiedUrl,
                        paramName: modifier.getValue(),
                        rule,
                    },
                });
            }

            return modifier.removeParameters(url);
        }, requestUrl);

        if (purgedUrl === requestUrl) {
            return null;
        }

        return purgedUrl;
    }

    private static isMethodSupported(method: string): boolean {
        return ParamsService.SupportedMethods.includes(method.toUpperCase());
    }
}

export const paramsService = new ParamsService(defaultFilteringLog);
