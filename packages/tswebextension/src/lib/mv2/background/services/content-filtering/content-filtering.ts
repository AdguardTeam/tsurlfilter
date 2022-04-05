import browser from 'webextension-polyfill';
import {
    RequestType, CosmeticRule, NetworkRule,
} from '@adguard/tsurlfilter';

import { RequestContext, requestContextStorage } from '../../request';
import { ContentStringFilter } from './content-string-filter';
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

    private static getHtmlRules(context: RequestContext): CosmeticRule[] | null {
        const { cosmeticResult } = context;

        /**
         * cosmeticResult is defined only for Document and Subdocument request types
         * do not need extra request type checking
         */
        if (!cosmeticResult) {
            return null;
        }

        const htmlRules = cosmeticResult.Html.getRules();

        if (htmlRules.length === 0) {
            return null;
        }

        return htmlRules;
    }

    private static getReplaceRules(context: RequestContext): NetworkRule[] | null {
        const { requestType, matchingResult } = context;

        if (!requestType
            || !matchingResult
            || !ContentFiltering.supportedReplaceRulesRequestTypes.includes(requestType)
        ) {
            return null;
        }

        const replaceRules = matchingResult.getReplaceRules();

        if (replaceRules.length === 0) {
            return null;
        }

        // Sort replace rules alphabetically as noted here
        // https://github.com/AdguardTeam/CoreLibs/issues/45
        return replaceRules.sort((prev: NetworkRule, next: NetworkRule) => {
            if (prev.getText() > next.getText()) {
                return 1;
            }

            if (prev.getText() < next.getText()) {
                return -1;
            }

            return 0;
        });
    }

    public static onBeforeRequest(requestId: string): void {
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
            const contentStringFilter = new ContentStringFilter(
                context,
                htmlRules,
                replaceRules,
                defaultFilteringLog,
            );

            const contentStream = new ContentStream(
                context,
                contentStringFilter,
                browser.webRequest.filterResponseData,
                defaultFilteringLog,
            );

            contentStream.init();
        }
    }
}
