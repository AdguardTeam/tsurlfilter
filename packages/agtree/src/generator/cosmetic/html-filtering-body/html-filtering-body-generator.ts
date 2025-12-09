import { type HtmlFilteringRuleBody } from '../../../nodes';
import { QuoteType, QuoteUtils } from '../../../utils/quotes';
import {
    CLOSE_PARENTHESIS,
    CLOSE_SQUARE_BRACKET,
    COLON,
    COMMA,
    EMPTY,
    OPEN_PARENTHESIS,
    OPEN_SQUARE_BRACKET,
    SPACE,
} from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';

/**
 * HTML Filtering attribute value transformer.
 */
type AttributeValueTransformer = (value: string) => string;

/**
 * HTML Filtering body generator.
 */
export class HtmlFilteringBodyGenerator extends BaseGenerator {
    /**
     * Error messages used by the generator.
     */
    public static readonly ERROR_MESSAGES = {
        EMPTY_BODY: 'HTML filtering rule body cannot be empty',
        EMPTY_SELECTOR_LIST: 'HTML filtering rule selector list cannot be empty',
        EMPTY_SELECTOR: 'HTML filtering rule selector cannot be empty',
        FIRST_SELECTOR_WITH_COMBINATOR: 'First selector cannot start with a combinator',
        MISSING_COMBINATOR: 'Missing combinator between selectors',
        ATTRIBUTE_OPERATOR_WITHOUT_VALUE: 'Attribute selector operator specified without a value',
        ATTRIBUTE_FLAG_WITHOUT_VALUE: 'Attribute selector flag specified without a value',
        ATTRIBUTE_VALUE_WITHOUT_OPERATOR: 'Attribute selector value specified without an operator',
        PSEUDO_CLASS_ARGUMENT_WITHOUT_FLAG: 'Non-function pseudo-class cannot have an argument',
    };

    private static defaultAttributeValueTransformer: AttributeValueTransformer = (value: string): string => value;

    /**
     * Generates a string representation of the HTML filtering rule body.
     *
     * @param node HTML filtering rule body.
     * @param attributeValueTransformer Optional transformer for attribute values.
     *
     * @returns String representation of the rule body.
     *
     * @throws Error if the rule body is invalid.
     */
    public static generate(
        node: HtmlFilteringRuleBody,
        attributeValueTransformer = HtmlFilteringBodyGenerator.defaultAttributeValueTransformer,
    ): string {
        const result: string[] = [];

        // Throw an error if the body is empty
        if (node.children.length === 0) {
            throw new Error(HtmlFilteringBodyGenerator.ERROR_MESSAGES.EMPTY_BODY);
        }

        // Traverse selector lists separated by commas
        for (let i = 0; i < node.children.length; i += 1) {
            const selectorList = node.children[i];

            // Throw an error if the selector list is empty
            if (selectorList.children.length === 0) {
                throw new Error(HtmlFilteringBodyGenerator.ERROR_MESSAGES.EMPTY_SELECTOR_LIST);
            }

            // Add comma separator between selector lists
            if (i > 0) {
                result.push(COMMA);
                result.push(SPACE);
            }

            // Traverse selectors within the selector list
            for (let j = 0; j < selectorList.children.length; j += 1) {
                const selector = selectorList.children[j];

                // Throw an error if the selector is empty
                if (selector.children.length === 0) {
                    throw new Error(HtmlFilteringBodyGenerator.ERROR_MESSAGES.EMPTY_SELECTOR);
                }

                // Throw an error if the first selector has a combinator
                if (j === 0 && selector.combinator) {
                    throw new Error(HtmlFilteringBodyGenerator.ERROR_MESSAGES.FIRST_SELECTOR_WITH_COMBINATOR);
                }

                // Throw an error if the combinator is missing
                if (j > 0 && !selector.combinator) {
                    throw new Error(HtmlFilteringBodyGenerator.ERROR_MESSAGES.MISSING_COMBINATOR);
                }

                // Add combinator between selectors
                if (selector.combinator) {
                    const isSpaceCombinator = selector.combinator.value === SPACE;

                    // For space combinator, ensure single spaces around it
                    if (!isSpaceCombinator) {
                        result.push(SPACE);
                    }

                    result.push(selector.combinator.value);

                    // For space combinator, ensure single spaces around it
                    if (!isSpaceCombinator) {
                        result.push(SPACE);
                    }
                }

                // Traverse parts within the selector
                for (let k = 0; k < selector.children.length; k += 1) {
                    const part = selector.children[k];

                    if (part.type === 'Value') {
                        // Value (tag name, ID, class name) can be pushed as-is
                        result.push(part.value);
                    } else if (part.type === 'HtmlFilteringRuleSelectorAttribute') {
                        // Attribute

                        // Throw an error if the operator is specified without a value
                        if (part.operator && !part.value) {
                            throw new Error(
                                HtmlFilteringBodyGenerator.ERROR_MESSAGES.ATTRIBUTE_OPERATOR_WITHOUT_VALUE,
                            );
                        }

                        // Throw an error if the flag is specified without a value
                        if (part.flag && !part.value) {
                            throw new Error(
                                HtmlFilteringBodyGenerator.ERROR_MESSAGES.ATTRIBUTE_FLAG_WITHOUT_VALUE,
                            );
                        }

                        // Throw an error if the value is specified without an operator
                        if (part.value && !part.operator) {
                            throw new Error(
                                HtmlFilteringBodyGenerator.ERROR_MESSAGES.ATTRIBUTE_VALUE_WITHOUT_OPERATOR,
                            );
                        }

                        result.push(OPEN_SQUARE_BRACKET);
                        result.push(part.name.value);

                        // If there is an operator, add it along with the value
                        if (part.operator) {
                            result.push(part.operator.value);

                            // It's safe to use non-null assertion here due to the earlier check
                            const { value } = part.value!;

                            // Quote the attribute value using double quotes
                            const quotedValue = QuoteUtils.setStringQuoteType(value, QuoteType.Double);

                            // Transform the attribute value if a transformer is provided
                            const transformedValue = attributeValueTransformer(quotedValue);

                            result.push(transformedValue);

                            // If there is a flag, add it as well
                            if (part.flag) {
                                result.push(SPACE);
                                result.push(part.flag.value);
                            }
                        }

                        result.push(CLOSE_SQUARE_BRACKET);
                    } else if (part.type === 'HtmlFilteringRuleSelectorPseudoClass') {
                        // Pseudo-class selector

                        // Throw an error if isFunction is false but argument is provided
                        if (part.argument && !part.isFunction) {
                            throw new Error(
                                HtmlFilteringBodyGenerator.ERROR_MESSAGES.PSEUDO_CLASS_ARGUMENT_WITHOUT_FLAG,
                            );
                        }

                        result.push(COLON);
                        result.push(part.name.value);

                        // Handle pseudo-class functions
                        if (part.isFunction) {
                            result.push(OPEN_PARENTHESIS);

                            if (part.argument) {
                                result.push(part.argument.value);
                            }

                            result.push(CLOSE_PARENTHESIS);
                        }
                    }
                }
            }
        }

        return result.join(EMPTY);
    }
}
