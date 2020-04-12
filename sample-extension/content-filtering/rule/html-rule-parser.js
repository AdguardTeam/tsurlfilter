/**
 * Encapsulates html rule parsing
 */
// eslint-disable-next-line import/extensions
import { Wildcard } from './wildcard.js';

export class HtmlRuleParser {
    ATTRIBUTE_START_MARK = '[';

    ATTRIBUTE_END_MARK = ']';

    QUOTES = '"';

    TAG_CONTENT_MASK = 'tag-content';

    WILDCARD_MASK = 'wildcard';

    TAG_CONTENT_MAX_LENGTH = 'max-length';

    TAG_CONTENT_MIN_LENGTH = 'min-length';

    PARENT_ELEMENTS = 'parent-elements';

    PARENT_SEARCH_LEVEL = 'parent-search-level';

    DEFAULT_PARENT_SEARCH_LEVEL = 3;

    /**
     * Parses html rule
     *
     * @param rule
     */
    parse(rule) {
        const result = {};

        result.parentSearchLevel = this.DEFAULT_PARENT_SEARCH_LEVEL;
        result.maxLength = 8192;

        const ruleContent = rule.getContent();
        let htmlAttributesStartIndex = ruleContent.indexOf(this.ATTRIBUTE_START_MARK);

        // Cutting tag name from string
        if (htmlAttributesStartIndex === -1) {
            result.tagName = ruleContent;
        } else {
            result.tagName = ruleContent.substring(0, htmlAttributesStartIndex);
        }

        const selector = [result.tagName];

        // Loading attributes filter
        while (htmlAttributesStartIndex !== -1) {
            const equalityIndex = ruleContent.indexOf('=', htmlAttributesStartIndex + 1);
            const quoteStartIndex = ruleContent.indexOf(this.QUOTES, equalityIndex + 1);
            const quoteEndIndex = this.getQuoteIndex(ruleContent, quoteStartIndex + 1);
            if (quoteStartIndex === -1 || quoteEndIndex === -1) {
                break;
            }
            const ruleEndIndex = ruleContent.indexOf(this.ATTRIBUTE_END_MARK, quoteEndIndex + 1);

            const attributeName = ruleContent.substring(htmlAttributesStartIndex + 1, equalityIndex);
            let attributeValue = ruleContent.substring(quoteStartIndex + 1, quoteEndIndex);
            attributeValue = HtmlRuleParser.replaceAll(attributeValue, '""', '"');

            switch (attributeName) {
                case this.TAG_CONTENT_MASK:
                    result.tagContentFilter = attributeValue;
                    break;
                case this.WILDCARD_MASK:
                    result.wildcard = new Wildcard(attributeValue);
                    break;
                case this.TAG_CONTENT_MAX_LENGTH:
                    result.maxLength = parseInt(attributeValue, 10);
                    break;
                case this.TAG_CONTENT_MIN_LENGTH:
                    result.minLength = parseInt(attributeValue, 10);
                    break;
                case this.PARENT_ELEMENTS:
                    result.parentElements = attributeValue.split(',');
                    break;
                case this.PARENT_SEARCH_LEVEL:
                    result.parentSearchLevel = parseInt(attributeValue, 10);
                    break;
                default:
                    selector.push('[');
                    selector.push(attributeName);
                    selector.push('*="');
                    selector.push(attributeValue);
                    selector.push('"]');
                    break;
            }

            if (ruleEndIndex === -1) {
                break;
            }

            htmlAttributesStartIndex = ruleContent.indexOf(this.ATTRIBUTE_START_MARK, ruleEndIndex + 1);
        }

        result.selector = selector.join('');

        // TODO: Validates selector immediately
        // eslint-disable-next-line no-undef
        // window.document.querySelectorAll(result.selector);

        return result;
    }

    /**
     * Look up next quotation
     *
     * @param text
     * @param startIndex
     * @return {number}
     */
    getQuoteIndex(text, startIndex) {
        let nextChar = '"';
        let quoteIndex = startIndex - 2;

        while (nextChar === '"') {
            quoteIndex = text.indexOf(this.QUOTES, quoteIndex + 2);
            if (quoteIndex === -1) {
                return -1;
            }
            nextChar = text.length === (quoteIndex + 1) ? '0' : text.charAt(quoteIndex + 1);
        }

        return quoteIndex;
    }

    /**
     * TODO: Extract utils
     *
     * @param str
     * @param find
     * @param replace
     * @return {string|*}
     */
    static replaceAll(str, find, replace) {
        if (!str) {
            return str;
        }
        return str.split(find).join(replace);
    }
}
