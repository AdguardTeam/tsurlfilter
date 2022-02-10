import browser from 'webextension-polyfill';
import { RequestType, CosmeticOption, CosmeticRule, NetworkRule } from '@adguard/tsurlfilter';

import { engineApi } from '../../engine-api';
import { RequestContext, requestContextStorage } from '../../request';
import { ContentStream } from './content-stream';
import { defaultFilteringLog } from '../../../../common';

/**
 * Content filtering module
 * Handles Html filtering and replace rules
 */
export class ContentFiltering {
    /**
     * Contains collection of supported request types for replace rules
     */
    private static supportedReplaceRulesRequestTypes = [
        RequestType.Document,
        RequestType.Subdocument,
        RequestType.Script,
        RequestType.Stylesheet,
        RequestType.XmlHttpRequest,
        RequestType.Other,
    ];

    /**
     * Contains collection of supported request types for html rules
     */
    private static supportedHtmlRulesRequestTypes = [
        RequestType.Document,
        RequestType.Subdocument,
    ];


    private static getHtmlRules(context: RequestContext): CosmeticRule[] | null {
        const { referrerUrl, requestType } = context;

        if (!referrerUrl ||
            !requestType ||
            !ContentFiltering.supportedHtmlRulesRequestTypes.includes(requestType)
        ) {
            return null;
        }

        const cosmeticResult = engineApi.getCosmeticResult(
            referrerUrl, CosmeticOption.CosmeticOptionHtml,
        );

        const htmlRules = cosmeticResult.Html.getRules();

        if (htmlRules.length === 0) {
            return null;
        }

        return htmlRules;
    }

    private static getReplaceRules(context: RequestContext): NetworkRule[] | null {
        const { requestType, matchingResult } = context;

        if (!requestType ||
            !matchingResult ||
            !ContentFiltering.supportedReplaceRulesRequestTypes.includes(requestType)
        ) {
            return null;
        }

        const replaceRules = matchingResult.getReplaceRules();

        if (replaceRules.length === 0) {
            return null;
        }

        return replaceRules;
    }

    public onBeforeRequest(requestId: string): void {
        if (!browser.webRequest.filterResponseData) {
            return;
        }

        const context = requestContextStorage.get(requestId);

        if (!context) {
            return;
        }

        const { method } = context;

        if (!(method === 'GET' || method === 'POST')) {
            return;
        }

        const htmlRules = ContentFiltering.getHtmlRules(context);

        const replaceRules = ContentFiltering.getReplaceRules(context);

        if (htmlRules || replaceRules) {

            if (htmlRules) {
                requestContextStorage.update(requestId, { htmlRules });
            }

            if (context.requestType) {
                const contentStream = new ContentStream(
                    context,
                    browser.webRequest.filterResponseData,
                    defaultFilteringLog,
                );

                contentStream.init();
            }
        }
    }
}

export const contentFilteringService = new ContentFiltering();
