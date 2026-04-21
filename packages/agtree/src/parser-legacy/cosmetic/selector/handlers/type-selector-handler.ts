import { AdblockSyntaxError } from '../../../../errors/adblock-syntax-error';
import { type TypeSelector } from '../../../../nodes';
import { type SelectorListParserContext } from '../context';

/**
 * Handles type selector parsing in selector list.
 */
export class TypeSelectorHandler {
    /**
     * Handles type selector parsing by creating a type selector node
     * and appending it to the current complex selector node.
     *
     * @param context Selector list parser context.
     *
     * @throws If the type selector is syntactically incorrect.
     */
    public static handle(context: SelectorListParserContext): void {
        const {
            options,
            baseOffset,
            stream,
            complexSelector,
            isTypeSelectorSet,
        } = context;

        // Get type selector token
        const token = stream.getOrFail();

        // Throw error if type selector is already set
        if (isTypeSelectorSet) {
            throw new AdblockSyntaxError(
                'Type selector is already set for the compound selector',
                baseOffset + token.start,
                baseOffset + token.end,
            );
        }

        // Throw error if type selector isn't first in the given compound selector
        if (
            // It should be first on current complex selector
            complexSelector.children.length !== 0
            // Or should be first on current compound selector (after combinator)
            && complexSelector.children[complexSelector.children.length - 1].type !== 'SelectorCombinator'
        ) {
            throw new AdblockSyntaxError(
                'Type selector must be first in the compound selector',
                baseOffset + token.start,
                baseOffset + token.end,
            );
        }

        // Extract type selector value
        const value = stream.fragment();

        // Construct type selector node
        const result: TypeSelector = {
            type: 'TypeSelector',
            value,
        };

        // Include type selector node locations if needed
        if (options.isLocIncluded) {
            result.start = baseOffset + token.start;
            result.end = baseOffset + token.start + value.length;
        }

        // Append type selector node to the current complex selector node
        complexSelector.children.push(result);

        // Advance type selector token
        stream.advance();

        // Mark that type name is set
        context.isTypeSelectorSet = true;
    }
}
