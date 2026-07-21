/**
 * @file Parameter generator.
 *
 * Serializes a {@link Parameter} AST node into its string representation,
 * respecting the quote type stored in the node.
 */

import type { Parameter } from '../../nodes-new';
import { QuoteUtils } from '../../utils';
import { BACKTICK_QUOTE, DOUBLE_QUOTE, SINGLE_QUOTE } from '../../utils/constants';
import { QuoteType } from '../../utils/quotes';
import { BaseGenerator } from '../base-generator';

/**
 * Maps a bounding {@link QuoteType} to its quote character.
 */
const QUOTE_CHAR_BY_TYPE: Partial<Record<QuoteType, string>> = {
    [QuoteType.Single]: SINGLE_QUOTE,
    [QuoteType.Double]: DOUBLE_QUOTE,
    [QuoteType.Backtick]: BACKTICK_QUOTE,
};

/**
 * Parameter generator.
 */
export class ParameterGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the parameter, wrapping the
     * unquoted value with the appropriate quote characters as specified
     * by the node's {@link Parameter.quoteType}.
     *
     * @param node Parameter node.
     *
     * @returns String representation of the parameter.
     */
    public static generate(node: Parameter): string {
        const quoteChar = QUOTE_CHAR_BY_TYPE[node.quoteType];

        // No (or unknown) bounding quote: emit the clean value verbatim.
        if (quoteChar === undefined) {
            return node.value;
        }

        // `Parameter.value` is already unquoted and unescaped, so escape the
        // selected delimiter and wrap unconditionally instead of letting
        // `setStringQuoteType` guess whether the content is already quoted —
        // that would strip legitimate outer quote characters from the value.
        return quoteChar + QuoteUtils.escapeUnescapedOccurrences(node.value, quoteChar) + quoteChar;
    }
}
