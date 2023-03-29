import { nanoid } from 'nanoid';
import { NetworkRule, RemoveParamModifier } from '@adguard/tsurlfilter';

import { requestContextStorage } from '../request';
import {
    defaultFilteringLog,
    FilteringEventType,
    FilteringLogInterface,
    getDomain,
} from '../../../common';

/**
 * Params filtering service module.
 */
export class ParamsService {
    private filteringLog: FilteringLogInterface;

    /**
     * Constructor.
     *
     * @param filteringLog Filtering log.
     */
    constructor(filteringLog: FilteringLogInterface) {
        this.filteringLog = filteringLog;
    }

    private static SupportedMethods = ['GET', 'OPTIONS', 'HEAD'];

    /**
     * Removes request params from url, stored in request context.
     *
     * @param requestId Request id.
     * @returns Modified url or null.
     */
    public getPurgedUrl(requestId: string): string | null {
        const context = requestContextStorage.get(requestId);

        if (!context) {
            return null;
        }

        const {
            matchingResult,
            method,
            requestUrl,
            contentType,
            timestamp,
        } = context;

        if (!matchingResult || !ParamsService.isMethodSupported(method)) {
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
                    type: FilteringEventType.RemoveParam,
                    data: {
                        removeParam: true,
                        eventId: nanoid(),
                        tabId: context.tabId,
                        requestUrl: modifiedUrl,
                        frameUrl: modifiedUrl,
                        frameDomain: getDomain(modifiedUrl) as string,
                        requestType: contentType,
                        rule,
                        timestamp,
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

    /**
     * Checks if we support requests for specified method.
     *
     * @param method Request method.
     * @returns True if method supported.
     */
    private static isMethodSupported(method: string): boolean {
        return ParamsService.SupportedMethods.includes(method.toUpperCase());
    }
}

export const paramsService = new ParamsService(defaultFilteringLog);
