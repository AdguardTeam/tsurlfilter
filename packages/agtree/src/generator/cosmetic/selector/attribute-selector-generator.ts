import { type AttributeSelector } from '../../../nodes';
import {
    CLOSE_SQUARE_BRACKET,
    DOUBLE_QUOTE,
    EMPTY,
    OPEN_SQUARE_BRACKET,
    SPACE,
} from '../../../utils/constants';
import { QuoteUtils } from '../../../utils/quotes';
import { BaseGenerator } from '../../base-generator';
import { ValueGenerator } from '../../misc/value-generator';

/**
 * Attribute selector generator.
 */
export class AttributeSelectorGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the attribute selector.
     *
     * @param node Attribute selector node.
     *
     * @returns String representation of the attribute selector.
     */
    public static generate(node: AttributeSelector): string {
        const result: string[] = [];

        result.push(OPEN_SQUARE_BRACKET);
        result.push(ValueGenerator.generate(node.name));

        if ('value' in node) {
            result.push(ValueGenerator.generate(node.operator));

            const generatedValue = ValueGenerator.generate(node.value);

            // AST values never include their quotes, so the value is always
            // quoted again. `QuoteUtils.setStringQuoteType()` cannot be used
            // here: it keeps a value that starts and ends with a double quote
            // as an already quoted one, which loses those literal quotes.
            const quotedValue = DOUBLE_QUOTE
                + QuoteUtils.escapeUnescapedOccurrences(generatedValue, DOUBLE_QUOTE)
                + DOUBLE_QUOTE;
            result.push(quotedValue);

            if (node.flag) {
                result.push(SPACE);
                result.push(ValueGenerator.generate(node.flag));
            }
        }

        result.push(CLOSE_SQUARE_BRACKET);

        return result.join(EMPTY);
    }
}
