import { SUPPORTED_CHARSETS, parseCharsetFromHeader } from './charsets';
import { ContentFilter } from './content-filter';
import { DocumentParser } from './doc-parser';
import { HtmlRuleParser } from './rule/html-rule-parser';
import { HtmlRuleSelector } from './rule/html-rule-selector';
import { Request, CosmeticRule, NetworkRule, ReplaceModifier, logger, RequestType } from '@adguard/tsurlfilter';
import { StreamFilter } from './stream-filter';
import { ModificationsListener } from './modifications-listener';

interface RequestDetails {
    request: Request;
    contentType: string | null;
    statusCode: number | null;
}

/**
 * Content filtering module
 * Handles Html filtering and replace rules
 */
export class ContentFiltering {
    /**
     * Filtering log
     */
    private readonly modificationsListener: ModificationsListener;

    // TODO: Use RequestContextStorage
    private readonly requestDetailsCallback: (requestId: number) => RequestDetails | null;

    /**
     * Constructor
     *
     * @param modificationsListener
     * @param requestDetailsCallback
     */
    constructor(
        modificationsListener: ModificationsListener,
        requestDetailsCallback: (requestId: number) => RequestDetails,
    ) {
        this.modificationsListener = modificationsListener;
        this.requestDetailsCallback = requestDetailsCallback;
    }

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
     * For correctly applying replace or content rules we have to work with the whole response content.
     * This function allows read response fully.
     * See some details here: https://mail.mozilla.org/pipermail/dev-addons/2017-April/002729.html
     *
     * @param request
     * @param streamFilter
     * @param callback
     */
    // eslint-disable-next-line consistent-return
    private handleResponse(
        request: Request,
        streamFilter: StreamFilter,
        callback: (x: string, context: RequestDetails | null) => string,
    ): void {
        const requestId = request.requestId!;

        try {
            // eslint-disable-next-line max-len
            const contentFilter = new ContentFilter(streamFilter, requestId, request.requestType, (content) => {
                this.modificationsListener.onModificationStarted(requestId);

                try {
                    const context = this.getRequestDetails(requestId);
                    if (context) {
                        const charset = parseCharsetFromHeader(context.contentType);
                        if (ContentFiltering.shouldProcessRequest(context, charset)) {
                            contentFilter.setCharset(charset);
                            // eslint-disable-next-line no-param-reassign
                            content = callback(content, context);
                        }
                    }
                } catch (ex) {
                    logger.error(`Error while applying content filter to ${request.url}. Error: ${ex}`);
                } finally {
                    this.modificationsListener.onModificationFinished(requestId);
                }

                contentFilter.write(content!);
            });
        } catch (e) {
            // eslint-disable-next-line max-len
            logger.error(`An error has occurred in content filter for request ${requestId} to ${request.url}. Error: ${e}`);
            callback('', null);
        }
    }

    /**
     * Checks if the request should be processed
     *
     * @param context
     * @param charset
     */
    private static shouldProcessRequest(context: RequestDetails, charset: string | null): boolean {
        if (!context.contentType) {
            return false;
        }

        if (context.statusCode !== 200) {
            return false;
        }

        if (charset && SUPPORTED_CHARSETS.indexOf(charset) < 0) {
            // Charset is detected and it is not supported
            logger.warn(`Skipping request ${context.request.requestId} with Content-Type ${context.contentType}`);
            return false;
        }

        return true;
    }

    /**
     * Applies Html rules to the document.
     * If document wasn't modified then method will return null
     *
     * @param request
     * @param {object} doc Document
     * @param {Array} rules Content rules
     * @returns null or document html
     */
    private applyHtmlRules(request: Request, doc: Document, rules: CosmeticRule[]): string | null {
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
                            request.tabId!, request.requestId!, element.innerHTML, request.url, rule,
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
     * @param request
     * @param content
     * @param replaceRules
     */
    private applyReplaceRules(request: Request, content: string, replaceRules: NetworkRule[]): string {
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
            // eslint-disable-next-line max-len
            this.modificationsListener.onReplaceRulesApplied(request.tabId!, request.requestId!, request.url, appliedRules);
        }

        return result;
    }

    /**
     * Checks if $replace rule should be applied to this request
     *
     * @returns {boolean}
     */
    private static shouldApplyReplaceRule(requestType: RequestType, contentType: string): boolean {
        if (ContentFiltering.replaceRulesRequestTypes.indexOf(requestType) >= 0) {
            return true;
        }

        if (requestType === RequestType.Other && contentType) {
            for (let i = 0; i < ContentFiltering.replaceRuleAllowedContentTypes.length; i += 1) {
                if (contentType.indexOf(ContentFiltering.replaceRuleAllowedContentTypes[i]) === 0) {
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
     * @param replaceRules
     * @param htmlRules
     * @param replaceRules
     * @param htmlRules
     * @returns {string} Modified content
     */
    private applyRulesToContent(
        context: RequestDetails | null,
        content: string,
        replaceRules: NetworkRule[],
        htmlRules: CosmeticRule[],
    ): string {
        if (!context) {
            return content;
        }

        let htmlRulesToApply: CosmeticRule[] | null = null;
        if (ContentFiltering.shouldApplyHtmlRules(context.request.requestType)) {
            htmlRulesToApply = htmlRules;
        }

        let replaceRulesToApply: NetworkRule[] | null = null;
        if (ContentFiltering.shouldApplyReplaceRule(context.request.requestType, context.contentType!)) {
            replaceRulesToApply = replaceRules;
        }

        if (!htmlRulesToApply && !replaceRulesToApply) {
            return content;
        }

        let result = content;

        if (htmlRulesToApply && htmlRulesToApply.length > 0) {
            const doc = this.documentParser.parse(content);
            if (doc !== null) {
                const modified = this.applyHtmlRules(context.request, doc, htmlRulesToApply);
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
            result = this.applyReplaceRules(context.request, result, replaceRulesToApply);
        }

        return result;
    }

    /**
     * OnBeforeRequest handler
     *
     * @param streamFilter
     * @param request
     * @param replaceRules
     * @param htmlRules
     */
    public onBeforeRequest(
        streamFilter: StreamFilter,
        request: Request,
        replaceRules: NetworkRule[],
        htmlRules: CosmeticRule[],
    ): void {
        if (!request.requestId) {
            return;
        }

        const {
            method, tabId,
        } = request;

        if (!tabId) {
            return;
        }

        if (method !== 'GET' && method !== 'POST') {
            return;
        }

        this.handleResponse(
            request,
            streamFilter,
            (content, context) => this.applyRulesToContent(context, content!, replaceRules, htmlRules),
        );
    }

    /**
     * Returns request details
     *
     * @param requestId
     */
    private getRequestDetails(requestId: number): RequestDetails | null {
        return this.requestDetailsCallback(requestId);
    }
}
