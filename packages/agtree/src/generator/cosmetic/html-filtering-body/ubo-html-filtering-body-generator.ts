import { type HtmlFilteringRuleBody } from '../../../nodes';
import { QuoteUtils } from '../../../utils/quotes';
import {
    CLOSE_PARENTHESIS,
    CLOSE_SQUARE_BRACKET,
    COLON,
    COMMA,
    DOUBLE_QUOTE,
    EMPTY,
    EQUALS,
    OPEN_PARENTHESIS,
    OPEN_SQUARE_BRACKET,
    SPACE,
    UBO_HTML_MASK,
} from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';

/**
 * uBlock HTML Filtering body generator.
 */
export class UboHtmlFilteringBodyGenerator extends BaseGenerator {
    /**
     * Error messages used by the generator.
     */
    public static readonly ERROR_MESSAGES = {
        EMPTY_BODY: 'HTML filtering rule body cannot be empty.',
        EMPTY_SELECTORS: 'HTML filtering rule body must have at least one selector.',
        EMPTY_BEFORE_PSEUDO_CLASS: 'Pseudo class cannot be the first child of a selector',
        FLAGS_WITHOUT_VALUE: 'Attribute flags cannot be specified without an attribute value.',
    };

    /**
     * Generates a string representation of the uBlock HTML filtering rule body.
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
            throw new Error(UboHtmlFilteringBodyGenerator.ERROR_MESSAGES.EMPTY_SELECTORS);
        }

        result.push(UBO_HTML_MASK);

        for (let i = 0; i < node.selectors.length; i += 1) {
            const selector = node.selectors[i];

            if (!selector.tagName && selector.attributes.length === 0) {
                if (selector.pseudoClasses.length > 0) {
                    throw new Error(UboHtmlFilteringBodyGenerator.ERROR_MESSAGES.EMPTY_BEFORE_PSEUDO_CLASS);
                }

                throw new Error(UboHtmlFilteringBodyGenerator.ERROR_MESSAGES.EMPTY_BODY);
            }

            // Add comma separator between selectors
            if (i > 0) {
                result.push(COMMA);
                result.push(SPACE);
            }

            // Tag name
            if (selector.tagName) {
                result.push(selector.tagName.value);
            }

            // Attributes
            for (const attribute of selector.attributes) {
                // Open bracket
                result.push(OPEN_SQUARE_BRACKET);

                // Attribute name
                result.push(attribute.name.value);

                if (!attribute.value && attribute.flags) {
                    throw new Error(UboHtmlFilteringBodyGenerator.ERROR_MESSAGES.FLAGS_WITHOUT_VALUE);
                }

                // Attribute value
                if (attribute.value) {
                    result.push(EQUALS);
                    result.push(DOUBLE_QUOTE);
                    result.push(attribute.value.value);
                    result.push(DOUBLE_QUOTE);

                    // Attribute flags
                    if (attribute.flags) {
                        result.push(SPACE);
                        result.push(attribute.flags.value);
                    }
                }

                // Close bracket
                result.push(CLOSE_SQUARE_BRACKET);
            }

            // Pseudo classes
            for (const pseudoClass of selector.pseudoClasses) {
                // Colon
                result.push(COLON);

                // Pseudo class name
                result.push(pseudoClass.name.value);

                // Open parenthesis
                result.push(OPEN_PARENTHESIS);

                // Pseudo class content
                result.push(pseudoClass.content.value);

                // Close parenthesis
                result.push(CLOSE_PARENTHESIS);
            }
        }

        return QuoteUtils.unescapeDoubleQuotes(result.join(EMPTY));
    }
}
