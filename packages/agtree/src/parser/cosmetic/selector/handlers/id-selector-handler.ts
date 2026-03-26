import { type IdSelector } from '../../../../nodes';
import { type SelectorListParserContext } from '../context';

/**
 * Handles ID selector parsing in selector list.
 */
export class IdSelectorHandler {
    /**
     * Handles ID selector parsing by creating an ID selector node
     * and appending it to the current complex selector node.
     *
     * @param context Selector list parser context.
     *
     * @throws If the ID selector is syntactically incorrect.
     */
    public static handle(context: SelectorListParserContext): void {
        const {
            raw,
            options,
            baseOffset,
            stream,
            complexSelector,
        } = context;

        // Get ID selector token
        const token = stream.getOrFail();

        // Extract ID selector value (`start + 1` - without hashmark)
        const value = raw.slice(token.start + 1, token.end);

        // Construct ID selector node
        const result: IdSelector = {
            type: 'IdSelector',
            value,
        };

        // Include ID selector node locations if needed
        if (options.isLocIncluded) {
            result.start = baseOffset + token.start;
            result.end = baseOffset + token.end;
        }

        // Append ID selector node to the current complex selector node
        complexSelector.children.push(result);

        // Advance ID selector token
        stream.advance();
    }
}
