import { WebRequest } from 'webextension-polyfill/namespaces/webRequest';
import { CosmeticRule, NetworkRule, ReplaceModifier, logger, RequestType } from '@adguard/tsurlfilter';
import { SUPPORTED_CHARSETS, parseCharsetFromHeader } from './charsets';
import { ContentFilter } from './content-filter';
import { DocumentParser } from './doc-parser';
import { HtmlRuleParser } from './rule/html-rule-parser';
import { HtmlRuleSelector } from './rule/html-rule-selector';
import { StreamFilter } from './stream-filter';
import { RequestContext, requestContextStorage } from '../../request/request-context-storage';
import { mockFilteringLog, FilteringLog } from '../../filtering-log';

/**
 * Content filtering module
 * Handles Html filtering and replace rules
 */
export class ContentFiltering {
    /**
     * Contains collection of accepted request types for replace rules
     */
    private static replaceRulesRequestTypes = [
        RequestType.Document,
        RequestType.Subdocument,
        RequestType.Script,
        RequestType.Stylesheet,
        RequestType.XmlHttpRequest,
    ];

    /**
     * Contains collection of accepted content types for replace rules
     */
    private static replaceRuleAllowedContentTypes = [
        'text/',
        'application/json',
        'application/xml',
        'application/xhtml+xml',
        'application/javascript',
        'application/x-javascript',
    ];

    /**
     * Document parser
     */
    private documentParser = new DocumentParser();

    /**
     * Filtering log
     */
    private readonly modificationsListener: FilteringLog;

    /**
     * Constructor
     *
     * @param modificationsListener
     */
    constructor(modificationsListener: FilteringLog) {
        this.modificationsListener = modificationsListener;
    }

    /**
     * For correctly applying replace or content rules we have to work with the whole response content.
     * This function allows read response fully.
     * See some details here: https://mail.mozilla.org/pipermail/dev-addons/2017-April/002729.html
     *
     * @param requestId
     * @param streamFilter
     */
    private setupContentFilter(
        requestId: string,
        streamFilter: StreamFilter,
    ): void {
        const context = requestContextStorage.get(requestId);
        if (!context || !context.requestType) {
            return;
        }

        try {
            const contentFilter = new ContentFilter(streamFilter, context.requestType, (content) => {
                this.modificationsListener.onModificationStarted(requestId);

                try {
                    const charset = parseCharsetFromHeader(context.contentTypeHeader);
                    if (ContentFiltering.shouldProcessRequest(context, charset)) {
                        contentFilter.setCharset(charset);
                        // eslint-disable-next-line no-param-reassign
                        content = this.applyRulesToContent(context, content!);
                    }
                } catch (ex) {
                    logger.error(`Error while applying content filter to ${context.requestUrl}. Error: ${ex}`);
                } finally {
                    this.modificationsListener.onModificationFinished(requestId);
                }

                contentFilter.write(content!);
            });
        } catch (e) {
            // eslint-disable-next-line max-len
            logger.error(`An error has occurred in content filter for request ${requestId} to ${context.requestUrl}. Error: ${e}`);
        }
    }

    /**
     * Checks if the request should be processed
     *
     * @param context
     * @param charset
     */
    private static shouldProcessRequest(context: RequestContext, charset: string | null): boolean {
        if (!context.contentTypeHeader) {
            return false;
        }

        if (context.statusCode !== 200) {
            return false;
        }

        if (charset && SUPPORTED_CHARSETS.indexOf(charset) < 0) {
            // Charset is detected and it is not supported
            logger.warn(`Skipping request ${context.requestId} with Content-Type ${context.contentTypeHeader}`);
            return false;
        }

        return true;
    }

    /**
     * Applies Html rules to the document.
     * If document wasn't modified then method will return null
     *
     * @param context
     * @param {object} doc Document
     * @param {Array} rules Content rules
     * @returns null or document html
     */
    private applyHtmlRules(context: RequestContext, doc: Document, rules: CosmeticRule[]): string | null {
        const deleted = [];

        for (let i = 0; i < rules.length; i += 1) {
            const rule = rules[i];

            const parsed = HtmlRuleParser.parse(rule);
            const elements = new HtmlRuleSelector(parsed).getMatchedElements(doc);
            if (elements) {
                for (let j = 0; j < elements.length; j += 1) {
                    const element = elements[j];
                    if (element.parentNode && deleted.indexOf(element) < 0) {
                        element.parentNode.removeChild(element);

                        this.modificationsListener.onHtmlRuleApplied(
                            context.tabId!, context.requestId, element.innerHTML, context.requestUrl!, rule,
                        );
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
        return deleted.length > 0 ? doctype + doc.documentElement.outerHTML : null;
    }

    /**
     * Applies replace rules to content
     *
     * @param context
     * @param content
     * @param replaceRules
     */
    private applyReplaceRules(context: RequestContext, content: string, replaceRules: NetworkRule[]): string {
        let modifiedContent = content;
        const appliedRules = [];

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

        let result = content;
        if (modifiedContent) {
            result = modifiedContent;
        }

        if (appliedRules.length > 0) {
            this.modificationsListener.onReplaceRulesApplied(
                context.tabId!, context.requestId, context.requestUrl!, appliedRules,
            );
        }

        return result;
    }

    /**
     * Checks if $replace rule should be applied to this request
     *
     * @returns {boolean}
     */
    private static shouldApplyReplaceRule(requestType: RequestType, contentTypeHeader: string): boolean {
        if (ContentFiltering.replaceRulesRequestTypes.indexOf(requestType) >= 0) {
            return true;
        }

        if (requestType === RequestType.Other && contentTypeHeader) {
            for (let i = 0; i < ContentFiltering.replaceRuleAllowedContentTypes.length; i += 1) {
                if (contentTypeHeader.indexOf(ContentFiltering.replaceRuleAllowedContentTypes[i]) === 0) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Checks if content filtration rules should by applied to this request
     * @param requestType Request type
     */
    private static shouldApplyHtmlRules(requestType: RequestType): boolean {
        return requestType === RequestType.Document
            || requestType === RequestType.Subdocument;
    }

    /**
     * Applies replace/content rules to the content
     *
     * @param context
     * @param {string} content
     * @returns {string} Modified content
     */
    private applyRulesToContent(
        context: RequestContext,
        content: string,
    ): string {
        let htmlRulesToApply: CosmeticRule[] | undefined;
        if (ContentFiltering.shouldApplyHtmlRules(context.requestType!)) {
            htmlRulesToApply = context.htmlRules;
        }

        let replaceRulesToApply: NetworkRule[] | null = null;
        if (context.matchingResult) {
            if (ContentFiltering.shouldApplyReplaceRule(context.requestType!, context.contentTypeHeader!)) {
                replaceRulesToApply = context.matchingResult.getReplaceRules();
            }
        }

        if (!htmlRulesToApply && !replaceRulesToApply) {
            return content;
        }

        let result = content;

        if (htmlRulesToApply && htmlRulesToApply.length > 0) {
            const doc = this.documentParser.parse(content);
            if (doc !== null) {
                const modified = this.applyHtmlRules(context, doc, htmlRulesToApply);
                if (modified !== null) {
                    result = modified;
                }
            }
        }

        // response content is over 3MB, ignore it
        if (result.length > 3 * 1024 * 1024) {
            return result;
        }

        if (replaceRulesToApply) {
            result = this.applyReplaceRules(context, result, replaceRulesToApply);
        }

        return result;
    }

    /**
     * OnBeforeRequest handler
     *
     * @param streamFilter
     * @param details
     */
    public onBeforeRequest(
        streamFilter: StreamFilter,
        details: WebRequest.OnBeforeRequestDetailsType,
    ): void {
        const {
            requestId, method, tabId,
        } = details;

        if (!requestId || !tabId) {
            return;
        }

        if (method !== 'GET' && method !== 'POST') {
            return;
        }

        this.setupContentFilter(requestId, streamFilter);
    }
}

export const contentFilteringService = new ContentFiltering(mockFilteringLog);
