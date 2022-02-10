import { RequestType, NetworkRule, ReplaceModifier } from '@adguard/tsurlfilter';
import { FilteringLog, defaultFilteringLog } from '../../../../common';

import { RequestContext } from '../../request';
import { documentParser } from './doc-parser';
import { HtmlRuleParser } from './rule/html-rule-parser';
import { HtmlRuleSelector } from './rule/html-rule-selector';

export interface ContentFilterInterface {
    /**
     * Applies Html rules to content.
     */
    applyHtmlRules: (content: string, context: RequestContext) => string;

    /**
     * Applies replace rules to content
     */
    applyReplaceRules: (content: string, context: RequestContext) => string;
}

export class ContentFilter implements ContentFilterInterface {
    filteringLog: FilteringLog;

    /**
     * Contains collection of accepted content types for replace rules
     */
    private readonly replaceRuleAllowedContentTypes = [
        'text/',
        'application/json',
        'application/xml',
        'application/xhtml+xml',
        'application/javascript',
        'application/x-javascript',
    ];

    constructor(filteringLog: FilteringLog) {
        this.filteringLog = filteringLog;
    }

    applyHtmlRules(content: string, context: RequestContext): string {
        const { htmlRules } = context;

        if (!htmlRules || htmlRules.length === 0) {
            return content;
        }

        const doc = documentParser.parse(content);

        if (!doc) {
            return content;
        }

        const deleted = [];

        for (let i = 0; i < htmlRules.length; i += 1) {
            const rule = htmlRules[i];

            const parsed = HtmlRuleParser.parse(rule);
            const elements = new HtmlRuleSelector(parsed).getMatchedElements(doc);
            if (elements) {
                for (let j = 0; j < elements.length; j += 1) {
                    const element = elements[j];
                    if (element.parentNode && deleted.indexOf(element) < 0) {
                        element.parentNode.removeChild(element);

                        this.filteringLog.addHtmlRuleApplyEvent({
                            tabId: context.tabId!,
                            requestId: context.requestId,
                            elementString: element.innerHTML,
                            frameUrl: context.requestUrl!,
                            rule,
                        });

                        deleted.push(element);
                    }
                }
            }
        }

        // Add <!DOCTYPE html ... >
        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/959
        // XMLSerializer is used to serialize doctype object
        // eslint-disable-next-line no-undef
        const doctype = doc.doctype ? `${new XMLSerializer().serializeToString(doc.doctype)}\r\n` : '';


        if (deleted.length > 0) {
            return doctype + doc.documentElement.outerHTML;
        }

        return content;
    }

    applyReplaceRules(content: string, context: RequestContext): string {
        const { matchingResult, requestType, contentTypeHeader } = context;

        if (!matchingResult) {
            return content;
        }


        if (requestType === RequestType.Other) {
            if (!contentTypeHeader ||
                !this.replaceRuleAllowedContentTypes.some(contentType => {
                    return contentTypeHeader.indexOf(contentType) === 0;
                })
            ) {
                return content;
            }
        }

        const replaceRules = matchingResult.getReplaceRules();

        if (replaceRules.length === 0) {
            return content;
        }

        // Sort replace rules alphabetically as noted here
        // https://github.com/AdguardTeam/CoreLibs/issues/45
        const sortedReplaceRules = replaceRules.sort((prev: NetworkRule, next: NetworkRule) => {
            if (prev.getText() > next.getText()) {
                return 1;
            }

            if (prev.getText() < next.getText()) {
                return -1;
            }

            return 0;
        });

        const appliedRules = [];

        let modifiedContent = content;

        for (let i = 0; i < sortedReplaceRules.length; i += 1) {
            const replaceRule = sortedReplaceRules[i];
            if (replaceRule.isAllowlist()) {
                appliedRules.push(replaceRule);
            } else {
                const advancedModifier = replaceRule.getAdvancedModifier() as ReplaceModifier;
                modifiedContent = advancedModifier.getApplyFunc()(modifiedContent);
                appliedRules.push(replaceRule);
            }
        }

        if (appliedRules.length > 0) {
            this.filteringLog.addReplaceRuleApplyEvent({
                tabId: context.tabId,
                requestId: context.requestId,
                frameUrl: context.requestUrl!,
                rules: appliedRules,
            });
        }

        return modifiedContent;
    }
}

export const contentFilter = new ContentFilter(defaultFilteringLog);
