import { SUPPORTED_CHARSETS, parseCharsetFromHeader } from './charsets';
import { ContentFilter } from './content-filter';
import { DocumentParser } from './doc-parser';
import { HtmlRuleParser } from './rule/html-rule-parser';
import { HtmlRuleSelector } from './rule/html-rule-selector';
import { StreamFilter } from './stream-filter';
import { CosmeticRule } from '../rules/cosmetic-rule';
import { NetworkRule } from '../rules/network-rule';
import { ReplaceModifier } from '../modifiers/replace-modifier';
import { ModificationsListener } from './modifications-listener';
import { logger } from '../utils/logger';
import { RequestContext } from './request-context';

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
    constructor(
        modificationsListener: ModificationsListener,
    ) {
        this.modificationsListener = modificationsListener;
    }

    /**
     * Document parser
     */
    private documentParser = new DocumentParser();

    /**
     * For correctly applying replace or content rules we have to work with the whole response content.
     * This function allows read response fully.
     * See some details here: https://mail.mozilla.org/pipermail/dev-addons/2017-April/002729.html
     *
     * @param requestContext
     * @param streamFilter
     * @param htmlRules
     * @param replaceRules
     * @param callback
     */
    // eslint-disable-next-line consistent-return
    private handleResponse(
        requestContext: RequestContext,
        streamFilter: StreamFilter,
        htmlRules: CosmeticRule[],
        replaceRules: NetworkRule[],
        callback: (x: string, context: RequestContext | null) => string,
    ): void {
        try {
            // eslint-disable-next-line max-len
            const contentFilter = new ContentFilter(
                streamFilter,
                requestContext,
                htmlRules,
                replaceRules,
                (content, context) => {
                    const {
                        requestId,
                        requestUrl,
                        contentType,
                    } = context;

                    this.modificationsListener.onModificationStarted(Number(requestId));

                    try {
                        const charset = parseCharsetFromHeader(contentType);
                        if (ContentFiltering.shouldProcessRequest(context, charset)) {
                            contentFilter.setCharset(charset);
                            // eslint-disable-next-line no-param-reassign
                            content = callback(content, context);
                        }
                    } catch (ex) {
                        logger.error(`Error while applying content filter to ${requestUrl}. Error: ${ex}`);
                    } finally {
                        this.modificationsListener.onModificationFinished(Number(requestId));
                    }

                    contentFilter.write(content!);
                });
        } catch (e) {
            // eslint-disable-next-line max-len
            logger.error(`An error has occurred in content filter for request ${requestContext.requestId} to ${requestContext.requestUrl}. Error: ${e}`);
            callback('', null);
        }
    }

    /**
     * Checks if the request should be processed
     *
     * @param context
     * @param charset
     */
    private static shouldProcessRequest(context: RequestContext, charset: string | null): boolean {
        if (!context.contentType) {
            return false;
        }

        if (context.statusCode !== 200) {
            return false;
        }

        if (charset && SUPPORTED_CHARSETS.indexOf(charset) < 0) {
            // Charset is detected and it is not supported
            logger.warn(`Skipping request ${context.requestId} with Content-Type ${context.contentType}`);
            return false;
        }

        return true;
    }

    /**
     * Applies Html rules to the document.
     * If document wasn't modified then method will return null
     *
     * @param context Request context
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

                        const { tab: { tabId }, requestId, requestUrl } = context;

                        this.modificationsListener.onHtmlRuleApplied(
                            tabId, Number(requestId), element.innerHTML, requestUrl, rule,
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
            // eslint-disable-next-line max-len
            const { tab: { tabId }, requestId, requestUrl } = context;
            this.modificationsListener.onReplaceRulesApplied(tabId, Number(requestId), requestUrl, appliedRules);
        }

        return result;
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
        context: RequestContext | null,
        content: string,
        replaceRules: NetworkRule[],
        htmlRules: CosmeticRule[],
    ): string {
        if (!context) {
            return content;
        }


        let result = content;

        if (htmlRules && htmlRules.length > 0) {
            const doc = this.documentParser.parse(content);
            if (doc !== null) {
                const modified = this.applyHtmlRules(context, doc, htmlRules);
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
            result = this.applyReplaceRules(context, result, replaceRules);
        }

        return result;
    }

    /**
     * OnBeforeRequest handler
     *
     * @param streamFilter
     * @param requestContext
     * @param replaceRules
     * @param htmlRules
     */
    public onBeforeRequest(
        streamFilter: StreamFilter,
        requestContext: RequestContext,
        replaceRules: NetworkRule[],
        htmlRules: CosmeticRule[],
    ): void {
        if (!requestContext.requestId) {
            streamFilter.disconnect();
            return;
        }

        const {
            method, tab,
        } = requestContext;

        if (!tab.tabId) {
            streamFilter.disconnect();
            return;
        }

        if (method !== 'GET' && method !== 'POST') {
            streamFilter.disconnect();
            return;
        }

        this.handleResponse(
            requestContext,
            streamFilter,
            htmlRules,
            replaceRules,
            (content, context) => this.applyRulesToContent(context, content!, replaceRules, htmlRules),
        );
    }
}
