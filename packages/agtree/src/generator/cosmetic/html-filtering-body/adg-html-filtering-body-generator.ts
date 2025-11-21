import { type HtmlFilteringRuleBody } from '../../../nodes';
import { QuoteUtils } from '../../../utils/quotes';
import {
    CLOSE_SQUARE_BRACKET,
    DOUBLE_QUOTE,
    EMPTY,
    EQUALS,
    OPEN_SQUARE_BRACKET,
} from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';

/**
 * AdGuard HTML Filtering body generator.
 */
export class AdgHtmlFilteringBodyGenerator extends BaseGenerator {
    /**
     * Error messages used by the generator.
     */
    public static readonly ERROR_MESSAGES = {
        EMPTY_BODY: 'HTML filtering rule body cannot be empty.',
        EMPTY_SELECTORS: 'HTML filtering rule body must have at least one selector.',
        MULTIPLE_SELECTORS: 'AdGuard HTML filtering rule body must have exactly one selector.',
        PSEUDO_CLASSES_NOT_SUPPORTED: 'AdGuard HTML filtering rules do not support pseudo-classes in selectors.',
        ATTRIBUTE_FLAGS_NOT_SUPPORTED: 'AdGuard HTML filtering rules do not support attribute flags.',
    };

    /**
     * Generates a string representation of the AdGuard HTML filtering rule body.
     *
     * @param node HTML filtering rule body.
     *
     * @returns String representation of the rule body.
     *
     * @throws Error if the rule body is invalid.
     */
    public static generate(node: HtmlFilteringRuleBody): string {
        const result: string[] = [];

        if (node.selectors.length === 0) {
            throw new Error(AdgHtmlFilteringBodyGenerator.ERROR_MESSAGES.EMPTY_SELECTORS);
        }

        if (node.selectors.length !== 1) {
            throw new Error(AdgHtmlFilteringBodyGenerator.ERROR_MESSAGES.MULTIPLE_SELECTORS);
        }

        const selector = node.selectors[0];

        if (!selector.tagName && selector.attributes.length === 0) {
            throw new Error(AdgHtmlFilteringBodyGenerator.ERROR_MESSAGES.EMPTY_BODY);
        }

        if (selector.pseudoClasses.length > 0) {
            throw new Error(AdgHtmlFilteringBodyGenerator.ERROR_MESSAGES.PSEUDO_CLASSES_NOT_SUPPORTED);
        }

        // Tag name
        if (selector.tagName) {
            result.push(selector.tagName.value);
        }

        // Attributes
        for (const attribute of selector.attributes) {
            if (attribute.flags) {
                throw new Error(AdgHtmlFilteringBodyGenerator.ERROR_MESSAGES.ATTRIBUTE_FLAGS_NOT_SUPPORTED);
            }

            // Open bracket
            result.push(OPEN_SQUARE_BRACKET);

            // Attribute name
            result.push(attribute.name.value);

            // Attribute value
            if (attribute.value) {
                result.push(EQUALS);
                result.push(DOUBLE_QUOTE);
                result.push(attribute.value.value);
                result.push(DOUBLE_QUOTE);
            }

            // Close bracket
            result.push(CLOSE_SQUARE_BRACKET);
        }

        return QuoteUtils.unescapeDoubleQuotes(result.join(EMPTY));
    }
}
