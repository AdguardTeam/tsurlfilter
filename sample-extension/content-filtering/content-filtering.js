/* eslint-disable import/extensions */
import { SUPPORTED_CHARSETS, parseCharsetFromHeader } from './charsets.js';
// eslint-disable-next-line import/no-unresolved
import * as AGUrlFilter from '../engine.js';
import { ContentFilter } from './content-filter.js';
import { DocumentParser } from './document-parser.js';
/**
 * Content filtering module
 * Handles Html filtering and replace rules
 */
export class ContentFiltering {
    /**
     * Document parser
     */
    documentParser = new DocumentParser();

    /**
     * For correctly applying replace or content rules we have to work with the whole response content.
     * This function allows read response fully.
     * See some details here: https://mail.mozilla.org/pipermail/dev-addons/2017-April/002729.html
     */
    handleResponse = (requestId, requestUrl, requestType, charset, callback) => {
        try {
            const contentFilter = new ContentFilter(requestId, requestType, charset, (content) => {
                if (!content) {
                    callback(null);
                    return;
                }

                try {
                    // eslint-disable-next-line no-param-reassign
                    content = callback(content);
                } catch (ex) {
                    console.error('Error while applying content filter to {0}. Error: {1}', requestUrl, ex);
                }

                contentFilter.write(content);
            });
        } catch (e) {
            // eslint-disable-next-line max-len
            console.error('An error has occurred in content filter for request {0} to {1} - {2}. Error: {3}', requestId, requestUrl, requestType, e);
            callback(null);
        }
    };

    /**
     * Applies content rules to the document.
     * If document wasn't modified then method will return null
     *
     * @param {object} doc Document
     * @param {Array} rules Content rules
     * @returns null or document html
     */
    // eslint-disable-next-line class-methods-use-this
    applyContentRules(doc, rules) {
        const deleted = [];

        for (let i = 0; i < rules.length; i += 1) {
            // const rule = rules[i];
            // TODO: Implement getMatchedElements
            // const elements = rule.getMatchedElements(doc);
            // if (elements) {
            //     for (let j = 0; j < elements.length; j += 1) {
            //         const element = elements[j];
            //         if (element.parentNode && deleted.indexOf(element) < 0) {
            //             element.parentNode.removeChild(element);
            //             // eslint-disable-next-line max-len
            //             // adguard.requestContextStorage.bindContentRule(requestId,
            //                  rule, adguard.utils.strings.elementToString(element));
            //             deleted.push(element);
            //         }
            //     }
            // }
        }

        // Add <!DOCTYPE html ... >
        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/959
        // XMLSerializer is used to serialize doctype object
        // eslint-disable-next-line no-undef
        const doctype = doc.doctype ? `${new XMLSerializer().serializeToString(doc.doctype)}\r\n` : '';
        return deleted.length > 0 ? doctype + doc.documentElement.outerHTML : null;
    }

    // eslint-disable-next-line class-methods-use-this
    applyReplaceRules(content, replaceRules) {
        let modifiedContent = content;
        const appliedRules = [];

        // Sort replace rules alphabetically as noted here
        // https://github.com/AdguardTeam/CoreLibs/issues/45
        const sortedReplaceRules = replaceRules.sort((prev, next) => {
            if (prev.ruleText > next.ruleText) {
                return 1;
            }
            if (prev.ruleText < next.ruleText) {
                return -1;
            }
            return 0;
        });

        for (let i = 0; i < sortedReplaceRules.length; i += 1) {
            const replaceRule = sortedReplaceRules[i];
            if (replaceRule.isWhitelist()) {
                appliedRules.push(replaceRule);
            } else {
                modifiedContent = replaceRule.getAdvancedModifier().getApplyFunc()(modifiedContent);
                appliedRules.push(replaceRule);
            }
        }

        let result = content;
        if (modifiedContent) {
            result = modifiedContent;
        }

        if (appliedRules.length > 0) {
            // adguard.requestContextStorage.update(requestId, { replaceRules: appliedRules });
        }

        return result;
    }

    /**
     * Checks if $replace rule should be applied to this request
     *
     * @returns {boolean}
     */
    // eslint-disable-next-line class-methods-use-this
    shouldApplyReplaceRule() {
        // TODO: Fix replace rules application criteria
        return true;

        // var requestTypeMask = adguard.rules.UrlFilterRule.contentTypes[requestType];
        // if ((requestTypeMask & replaceRuleAllowedRequestTypeMask) === requestTypeMask) {
        //     return true;
        // }

        // if (requestType === adguard.RequestTypes.OTHER && contentType) {
        //     for (let i = 0; i < replaceRuleAllowedContentTypes.length; i++) {
        //         if (contentType.indexOf(replaceRuleAllowedContentTypes[i]) === 0) {
        //             return true;
        //         }
        //     }
        // }

        // return false;
    }

    /**
     * Checks if content filtration rules should by applied to this request
     * @param requestType Request type
     */
    // eslint-disable-next-line class-methods-use-this
    shouldApplyContentRules(requestType) {
        return requestType === AGUrlFilter.RequestType.DOCUMENT
            || requestType === AGUrlFilter.RequestType.SUBDOCUMENT;
    }

    /**
     * Applies replace/content rules to the content
     *
     * @param details
     * @param {Array} contentRules
     * @param {Array} replaceRules
     * @param {string} content
     * @returns {string} Modified content
     */
    // eslint-disable-next-line max-len
    applyRulesToContent(details, contentRules, replaceRules, content) {
        if (!content) {
            return content;
        }

        let result = content;

        if (contentRules && contentRules.length > 0) {
            const doc = this.documentParser.parse(content);
            if (doc !== null) {
                // eslint-disable-next-line max-len
                const modified = this.applyContentRules(doc, contentRules);
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
            const modifiedContent = this.applyReplaceRules(content, replaceRules);
            if (modifiedContent !== null) {
                result = modifiedContent;
            }
        }

        return result;
    }

    /**
     * Applies content and replace rules to the request
     *
     * @param details
     * @param contentType Content-Type header
     * @param replaceRules
     * @param htmlRules
     */
    apply(details, contentType, replaceRules, htmlRules) {
        const {
            requestUrl, requestType, requestId, statusCode, method,
        } = details;

        if (statusCode !== 200) {
            console.debug('Skipping request to {0} - {1} with status {2}', requestUrl, requestType, statusCode);
            return;
        }

        if (method !== 'GET' && method !== 'POST') {
            console.debug('Skipping request to {0} - {1} with method {2}', requestUrl, requestType, method);
            return;
        }

        const charset = parseCharsetFromHeader(contentType);
        if (charset && SUPPORTED_CHARSETS.indexOf(charset) < 0) {
            // Charset is detected and it is not supported
            console.warn('Skipping request to {0} - {1} with Content-Type {2}', requestUrl, requestType, contentType);
            return;
        }

        let htmlRulesToApply = null;
        if (this.shouldApplyContentRules(requestType)) {
            htmlRulesToApply = htmlRules;
        }

        let replaceRulesToApply = null;
        if (this.shouldApplyReplaceRule(requestType, contentType)) {
            replaceRulesToApply = replaceRules;
        }

        if (!htmlRulesToApply && !replaceRulesToApply) {
            return;
        }

        // Call this method to prevent removing context on request complete/error event
        // adguard.requestContextStorage.onContentModificationStarted(requestId);

        this.handleResponse(requestId, requestUrl, requestType, charset, (content) => {
            try {
                // eslint-disable-next-line max-len
                return this.applyRulesToContent(details, htmlRulesToApply, replaceRulesToApply, content);
            } finally {
                // adguard.requestContextStorage.onContentModificationFinished(requestId);
            }
        });
    }
}
