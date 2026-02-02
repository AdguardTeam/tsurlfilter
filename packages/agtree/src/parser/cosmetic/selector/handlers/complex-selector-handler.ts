import { getFormattedTokenName } from '@adguard/css-tokenizer';
import { sprintf } from 'sprintf-js';

import { type ComplexSelector } from '../../../../nodes';
import { AdblockSyntaxError } from '../../../../errors/adblock-syntax-error';
import { type SelectorListParserContext } from '../context';
import { CompoundSelectorHandler } from './compound-selector-handler';

/**
 * Handles complex selector parsing in selector list.
 */
export class ComplexSelectorHandler {
    /**
     * Finishes the current complex selector by:
     * 1. Finishing current compound selector node via {@link CompoundSelectorHandler},
     * 2. Validating current complex selector node,
     * 3. Appending current complex selector node to the selector list node,
     * If `isEof` is `false`:
     * 4. Constructing next complex selector node.
     *
     * @param context Selector list parser context.
     * @param isEof Indicates whether the end of the file has been reached.
     *
     * @throws If the current compound / complex selector has no simple selectors / compound selectors.
     */
    public static handle(context: SelectorListParserContext, isEof = true): void {
        const {
            raw,
            options,
            baseOffset,
            stream,
            token,
            result,
            complexSelector,
        } = context;

        // Get current complex selector end token
        const currentEndToken = stream.lookbehindForNonWs();

        // Finish current compound selector node
        CompoundSelectorHandler.handle(context);

        // Throw error if current complex selector node has no compound selector nodes (empty)
        if (!currentEndToken || complexSelector.children.length === 0) {
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

        // Include current complex selector node end location if needed
        if (options.isLocIncluded) {
            complexSelector.end = baseOffset + currentEndToken.end;
        }

        // Append current complex selector node to selector list node
        result.children.push(complexSelector);

        // If EOF is reached, just return, as we don't need to construct a next complex selector node
        if (isEof) {
            return;
        }

        // Get next complex selector node start token
        const nextStartToken = stream.getOrFail();

        // Construct next complex selector node
        const nextComplexSelector: ComplexSelector = {
            type: 'ComplexSelector',
            children: [],
        };

        // Include next complex selector node start location if needed
        if (options.isLocIncluded) {
            nextComplexSelector.start = baseOffset + nextStartToken.start;
        }

        // Update context with new complex selector
        context.complexSelector = nextComplexSelector;

        // Reset type selector set tracker for new selector
        context.isTypeSelectorSet = false;
    }
}
