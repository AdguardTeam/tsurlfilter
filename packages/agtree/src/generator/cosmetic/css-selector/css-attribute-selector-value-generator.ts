import { type CssAttributeSelectorValue } from '../../../nodes';
import { QuoteType, QuoteUtils } from '../../../utils/quotes';
import { EMPTY, SPACE } from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';
import { ValueGenerator } from '../../misc/value-generator';

/**
 * CSS attribute selector value generator.
 */
export class CssAttributeSelectorValueGenerator extends BaseGenerator {
    /**
     * Case insensitive flag for attribute selector values.
     * For example: [attr="value" i]
     */
    private static readonly CASE_INSENSITIVE_FLAG = 'i';

    /**
     * Case sensitive flag for attribute selector values.
     * For example: [attr="value" s]
     */
    private static readonly CASE_SENSITIVE_FLAG = 's';

    /**
     * Generates a string representation of the CSS attribute selector value.
     *
     * @param node CSS attribute selector value node.
     *
     * @returns String representation of the CSS attribute selector value.
     */
    public static generate(node: CssAttributeSelectorValue): string {
        const result: string[] = [];

        result.push(ValueGenerator.generate(node.operator));

        const generatedValue = ValueGenerator.generate(node.value);
        const quotedValue = QuoteUtils.setStringQuoteType(generatedValue, QuoteType.Double);
        result.push(quotedValue);

        if (node.isCaseSensitive !== undefined) {
            const flag = node.isCaseSensitive
                ? CssAttributeSelectorValueGenerator.CASE_SENSITIVE_FLAG
                : CssAttributeSelectorValueGenerator.CASE_INSENSITIVE_FLAG;

            result.push(SPACE);
            result.push(flag);
        }

        return result.join(EMPTY);
    }
}
