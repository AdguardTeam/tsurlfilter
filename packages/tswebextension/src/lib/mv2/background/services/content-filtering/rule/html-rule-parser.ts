import { type CosmeticRule, replaceAll } from '@adguard/tsurlfilter';

import { Wildcard } from './wildcard';
import { HtmlRuleAttributes } from './html-rule-attributes';

/**
 * Encapsulates html rule attributes parsing.
 */
// TODO: Move this parser to AGTree
// TODO: Add support for `:contains()` (https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3150)
export class HtmlRuleParser {
    private static ATTRIBUTE_START_MARK = '[';

    private static ATTRIBUTE_END_MARK = ']';

    private static QUOTES = '"';

    private static TAG_CONTENT_MASK = 'tag-content';

    private static WILDCARD_MASK = 'wildcard';

    private static TAG_CONTENT_MAX_LENGTH = 'max-length';

    private static TAG_CONTENT_MIN_LENGTH = 'min-length';

    private static PARENT_ELEMENTS = 'parent-elements';

    private static PARENT_SEARCH_LEVEL = 'parent-search-level';

    private static DEFAULT_PARENT_SEARCH_LEVEL = 3;

    private static DEFAULT_MAX_LENGTH = 8192;

    /**
     * Parses html rule.
     *
     * @param rule Rule to parse.
     *
     * @returns Parsed rule attributes or `null` if selector is invalid.
     */
    public static parse(rule: CosmeticRule): HtmlRuleAttributes | null {
        const result = new HtmlRuleAttributes();

        result.parentSearchLevel = HtmlRuleParser.DEFAULT_PARENT_SEARCH_LEVEL;
        result.maxLength = HtmlRuleParser.DEFAULT_MAX_LENGTH;

        const ruleContent = rule.getContent();
        let htmlAttributesStartIndex = ruleContent.indexOf(HtmlRuleParser.ATTRIBUTE_START_MARK);

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

            // if there is no equality sign inside of `[...]`,
            // consider it as a simple standard attribute, e.g. 'div[custom_attr]'
            // because special attributes, i.e. 'tag-content', require value
            if (equalityIndex === -1) {
                const currentAttrEndIndex = ruleContent.indexOf(
                    HtmlRuleParser.ATTRIBUTE_END_MARK,
                    htmlAttributesStartIndex + 1,
                );

                const attributeName = ruleContent.substring(htmlAttributesStartIndex + 1, currentAttrEndIndex);

                selector.push(HtmlRuleParser.ATTRIBUTE_START_MARK);
                selector.push(attributeName);
                selector.push(HtmlRuleParser.ATTRIBUTE_END_MARK);

                htmlAttributesStartIndex = ruleContent.indexOf(
                    HtmlRuleParser.ATTRIBUTE_START_MARK,
                    currentAttrEndIndex + 1,
                );
                continue;
            }

            const quoteStartIndex = ruleContent.indexOf(HtmlRuleParser.QUOTES, equalityIndex + 1);
            const quoteEndIndex = HtmlRuleParser.getClosingQuoteIndex(ruleContent, quoteStartIndex + 1);
            if (quoteStartIndex === -1 || quoteEndIndex === -1) {
                break;
            }
            const ruleEndIndex = ruleContent.indexOf(HtmlRuleParser.ATTRIBUTE_END_MARK, quoteEndIndex + 1);

            const attributeName = ruleContent.substring(htmlAttributesStartIndex + 1, equalityIndex);
            let attributeValue = ruleContent.substring(quoteStartIndex + 1, quoteEndIndex);
            attributeValue = replaceAll(attributeValue, '""', '"');

            switch (attributeName) {
                case HtmlRuleParser.TAG_CONTENT_MASK:
                    result.tagContentFilter = attributeValue;
                    break;
                case HtmlRuleParser.WILDCARD_MASK:
                    result.wildcard = new Wildcard(attributeValue);
                    break;
                case HtmlRuleParser.TAG_CONTENT_MAX_LENGTH:
                    result.maxLength = parseInt(attributeValue, 10);
                    break;
                case HtmlRuleParser.TAG_CONTENT_MIN_LENGTH:
                    result.minLength = parseInt(attributeValue, 10);
                    break;
                case HtmlRuleParser.PARENT_ELEMENTS:
                    result.parentElements = attributeValue.split(',');
                    break;
                case HtmlRuleParser.PARENT_SEARCH_LEVEL:
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

            htmlAttributesStartIndex = ruleContent.indexOf(HtmlRuleParser.ATTRIBUTE_START_MARK, ruleEndIndex + 1);
        }

        result.selector = selector.join('');

        // Validates selector immediately
        // eslint-disable-next-line no-undef
        if (typeof window !== 'undefined') {
            try {
                // Make a dummy query to check if selector is valid
                // TODO: Once we add custom pseudo classes (like `:contains()`), we need a custom validation
                // via `@adguard/css-tokenizer`
                // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3150
                window.document.querySelector(result.selector);
            } catch {
                return null;
            }
        }

        return result;
    }

    /**
     * Looks up next closing quotation starting from start index.
     * Skips double quotes in text like:
     *  [tag-content="teas""ernet"].
     *
     * @param text Text to search.
     * @param startIndex Start index.
     *
     * @returns Index of closing double quotation `"` found, or `-1` if not found.
     */
    private static getClosingQuoteIndex(text: string, startIndex: number): number {
        let nextChar = HtmlRuleParser.QUOTES;
        let quoteIndex = startIndex - 2;

        while (nextChar === '"') {
            quoteIndex = text.indexOf(HtmlRuleParser.QUOTES, quoteIndex + 2);
            if (quoteIndex === -1) {
                return -1;
            }

            nextChar = text.length === (quoteIndex + 1) ? '0' : text.charAt(quoteIndex + 1);
        }

        return quoteIndex;
    }
}
