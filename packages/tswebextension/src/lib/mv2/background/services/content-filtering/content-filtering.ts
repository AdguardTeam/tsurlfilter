import browser from 'webextension-polyfill';
import {
    RequestType,
    type CosmeticRule,
    type NetworkRule,
    NetworkRuleOption,
} from '@adguard/tsurlfilter';

import { defaultFilteringLog } from '../../../../common/filtering-log';
import { type RequestContext } from '../../request';

import { ContentStringFilter } from './content-string-filter';
import { ContentStream } from './content-stream';

/**
 * Content filtering module.
 * Handles Html filtering and replace rules.
 */
export class ContentFiltering {
    /**
     * Contains collection of supported request types for replace rules.
     */
    private static readonly supportedReplaceRulesRequestTypes: RequestType[] = [
        RequestType.Document,
        RequestType.SubDocument,
        RequestType.Script,
        RequestType.Stylesheet,
        RequestType.XmlHttpRequest,
        RequestType.Other,
    ];

    /**
     * Retrieves html rules.
     *
     * @param context Request context.
     *
     * @returns Html rules or null.
     */
    private static getHtmlRules(context: RequestContext): CosmeticRule[] | null {
        const { cosmeticResult } = context;

        /**
         * "cosmeticResult" is defined only for Document and Subdocument request types
         * do not need extra request type checking.
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

    /**
     * Retrieves replace rules and sorts them alphabetically.
     *
     * @param context Request context.
     *
     * @returns Replace rules or null.
     */
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
            // Compare by pattern first
            const patternComparison = prev.getPattern().localeCompare(next.getPattern());
            if (patternComparison !== 0) {
                return patternComparison;
            }

            // Compare by advanced modifier value if both exist
            const prevAdvancedModifier = prev.getAdvancedModifier();
            const nextAdvancedModifier = next.getAdvancedModifier();

            if (prevAdvancedModifier && nextAdvancedModifier) {
                return prevAdvancedModifier.getValue().localeCompare(nextAdvancedModifier.getValue());
            }

            // If one or both do not have an advanced modifier, keep the order
            return 0;
        });
    }

    /**
     * Checks if request content filtering disabled by exception rule with $content modifier.
     *
     * @param context Request context.
     *
     * @returns `true`, if content filtering disabled by exception rule with $content modifier,
     * overwise returns `false`.
     */
    private static hasContentExceptionRule(context: RequestContext): boolean {
        const { matchingResult } = context;

        if (!matchingResult) {
            return false;
        }

        const rule = matchingResult.getBasicResult();

        if (!rule) {
            return false;
        }

        // The $content modifier only applies with the exception rule.
        // We don't need additional `rule.isAllowlist()` check.
        return rule.isOptionEnabled(NetworkRuleOption.Content);
    }

    /**
     * Checks if request method is supported.
     *
     * @param context Request context.
     *
     * @returns `true`, if request method is supported,
     * overwise returns `false`.
     */
    private static isRequestMethodSupported(context: RequestContext): boolean {
        const { method } = context;

        return method === 'GET' || method === 'POST';
    }

    /**
     * On before request event handler.
     *
     * @param context Request context.
     */
    public static onBeforeRequest(context: RequestContext): void {
        if (!browser.webRequest.filterResponseData
            || !ContentFiltering.isRequestMethodSupported(context)
            || ContentFiltering.hasContentExceptionRule(context)) {
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
