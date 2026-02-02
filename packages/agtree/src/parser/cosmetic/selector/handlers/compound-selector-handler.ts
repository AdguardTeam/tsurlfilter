import { sprintf } from 'sprintf-js';
import { getFormattedTokenName } from '@adguard/css-tokenizer';

import { type SelectorCombinator, type SelectorCombinatorValue } from '../../../../nodes';
import { AdblockSyntaxError } from '../../../../errors/adblock-syntax-error';
import {
    COMMA,
    GREATER_THAN,
    PLUS,
    SPACE,
    TILDE,
} from '../../../../utils/constants';
import { type SelectorListParserContext } from '../context';

/**
 * Handles compound selector parsing in selector list.
 */
export class CompoundSelectorHandler {
    /**
     * Set of allowed symbols between selectors (combinators + comma, except <space> combinator).
     *
     * @see {@link SelectorCombinatorValue}
     */
    private static readonly ALLOWED_SYMBOLS_BETWEEN_SELECTORS: ReadonlySet<string> = new Set([
        // div > span
        GREATER_THAN,

        // div + div
        PLUS,

        // div ~ div
        TILDE,

        // div, span
        COMMA,
    ]);

    /**
     * Finishes the current compound selector by:
     * 1. Validating current compound selector node,
     * 2. Constructing selector combinator node (if provided),
     * 3. Appending selector combinator node to the complex selector (if provided).
     *
     * @param context Selector list parser context.
     * @param combinator Optional combinator string.
     *
     * @throws If the current compound selector has no simple selectors.
     */
    public static handle(context: SelectorListParserContext, combinator?: SelectorCombinatorValue): void {
        const {
            raw,
            options,
            baseOffset,
            stream,
            token,
            complexSelector,
        } = context;

        // Get current compound selector end token
        const currentEndToken = stream.lookbehindForNonWs();

        // Throw error if current compound selector has no simple selectors (empty)
        if (
            // Combinator shouldn't be the first token in the complex selector
            !currentEndToken
            || complexSelector.children.length === 0
            // And the last token in the complex selector shouldn't be a combinator
            || complexSelector.children[complexSelector.children.length - 1].type === 'SelectorCombinator'
        ) {
            throw new AdblockSyntaxError(
                sprintf(
                    "Unexpected token '%s' with value '%s'",
                    getFormattedTokenName(token.type),
                    raw.slice(token.start, token.end),
                ),
                baseOffset + token.start,
                baseOffset + token.end,
            );
        }

        // Handle edge case for descendant combinator
        if (combinator === SPACE) {
            // Skip whitespaces before checking next token
            stream.skipWhitespace();

            // EOF - just skip, we shouldn't consider it as descendant combinator
            if (!stream.get()) {
                return;
            }

            // Combinator or Comma - just skip, we shouldn't consider it as descendant combinator
            if (CompoundSelectorHandler.ALLOWED_SYMBOLS_BETWEEN_SELECTORS.has(stream.fragment())) {
                return;
            }
        } else {
            // Advance selector combinator token
            stream.advance();

            // Skip whitespaces after selector combinator token
            stream.skipWhitespace();
        }

        // If no combinator is provided, just return, as we don't need to create and append selector combinator node
        if (!combinator) {
            return;
        }

        // Next compound selector token should be defined
        stream.getOrFail();

        // Construct selector combinator node
        const result: SelectorCombinator = {
            type: 'SelectorCombinator',
            value: combinator,
        };

        // Include selector combinator node locations if needed
        if (options.isLocIncluded) {
            result.start = baseOffset + token.start;
            result.end = baseOffset + token.start + combinator.length;
        }

        // Append selector combinator node to the current complex selector node
        complexSelector.children.push(result);

        // Reset type selector set tracker for next compound selector
        context.isTypeSelectorSet = false;
    }
}
