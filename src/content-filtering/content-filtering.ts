import { SUPPORTED_CHARSETS, parseCharsetFromHeader } from './charsets';
import { ContentFilter } from './content-filter';
import { DocumentParser } from './doc-parser';
import { HtmlRuleParser } from './rule/html-rule-parser';
import { HtmlRuleSelector } from './rule/html-rule-selector';
import { Request } from '../request';
import { StreamFilter } from './stream-filter';
import { CosmeticRule } from '../rules/cosmetic-rule';
import { NetworkRule } from '../rules/network-rule';
import { ReplaceModifier } from '../modifiers/replace-modifier';
import { ModificationsListener } from './modifications-listener';
import { logger } from '../utils/logger';
import { RequestType } from '../request-type';

/**
 * Content filtering module
 * Handles Html filtering and replace rules
 */
export class ContentFiltering {
    /**
     * Filtering log
     */
    private readonly modificationsListener: ModificationsListener;

    /**
     * Constructor
     *
     * @param modificationsListener
     */
    constructor(modificationsListener: ModificationsListener) {
        this.modificationsListener = modificationsListener;
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
     * @param streamFilter
     * @param request
     * @param charset
     * @param callback
     */
    private handleResponse(
        streamFilter: StreamFilter,
        request: Request,
        charset: string | null,
        callback: (x: string) => string,
    ): void {
        try {
            // eslint-disable-next-line max-len
            const contentFilter = new ContentFilter(streamFilter, request.requestId!, request.requestType, charset, (content) => {
                this.modificationsListener.onModificationStarted(request.requestId!);

                try {
                    // eslint-disable-next-line no-param-reassign
                    content = callback(content);
                } catch (ex) {
                    logger.error(`Error while applying content filter to ${request.url}. Error: ${ex}`);
                } finally {
                    this.modificationsListener.onModificationFinished(request.requestId!);
                }

                contentFilter.write(content!);
            });
        } catch (e) {
            // eslint-disable-next-line max-len
            logger.error(`An error has occurred in content filter for request ${request.requestId} to ${request.url}. Error: ${e}`);
            callback('');
        }
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
     * @param request
     * @param {Array} contentRules
     * @param {Array} replaceRules
     * @param {string} content
     * @returns {string} Modified content
     */
    private applyRulesToContent(
        request: Request,
        contentRules: CosmeticRule[] | null,
        replaceRules: NetworkRule[] | null,
        content: string,
    ): string {
        let result = content;

        if (contentRules && contentRules.length > 0) {
            const doc = this.documentParser.parse(content);
            if (doc !== null) {
                const modified = this.applyHtmlRules(request, doc, contentRules);
                if (modified !== null) {
                    result = modified;
                }
            }
        }

        // response content is over 3MB, ignore it
        if (result.length > 3 * 1024 * 1024) {
            return result;
        }

        if (replaceRules) {
            result = this.applyReplaceRules(request, result, replaceRules);
        }

        return result;
    }

    /**
     * Applies content and replace rules to the request
     *
     * @param streamFilter
     * @param request
     * @param contentType Content-Type header
     * @param replaceRules
     * @param htmlRules
     */
    public apply(
        streamFilter: StreamFilter,
        request: Request,
        contentType: string,
        replaceRules: NetworkRule[],
        htmlRules: CosmeticRule[],
    ): void {
        const {
            requestId, requestType, statusCode, method, tabId,
        } = request;

        if (!requestId || !tabId) {
            return;
        }

        if (statusCode !== 200) {
            return;
        }

        if (method !== 'GET' && method !== 'POST') {
            return;
        }

        const charset = parseCharsetFromHeader(contentType);
        if (charset && SUPPORTED_CHARSETS.indexOf(charset) < 0) {
            // Charset is detected and it is not supported
            logger.warn(`Skipping request ${request.requestId} with Content-Type ${contentType}`);
            return;
        }

        let htmlRulesToApply: CosmeticRule[] | null = null;
        if (ContentFiltering.shouldApplyHtmlRules(requestType)) {
            htmlRulesToApply = htmlRules;
        }

        let replaceRulesToApply: NetworkRule[] | null = null;
        if (ContentFiltering.shouldApplyReplaceRule(requestType, contentType)) {
            replaceRulesToApply = replaceRules;
        }

        if (!htmlRulesToApply && !replaceRulesToApply) {
            return;
        }

        this.handleResponse(
            streamFilter,
            request,
            charset,
            (content) => this.applyRulesToContent(request, htmlRulesToApply, replaceRulesToApply, content!),
        );
    }
}
