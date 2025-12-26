import { type AttributeSelector } from '../../../nodes';
import { QuoteType, QuoteUtils } from '../../../utils/quotes';
import {
    CLOSE_SQUARE_BRACKET,
    EMPTY,
    OPEN_SQUARE_BRACKET,
    SPACE,
} from '../../../utils/constants';
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
            const quotedValue = QuoteUtils.setStringQuoteType(generatedValue, QuoteType.Double);
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
