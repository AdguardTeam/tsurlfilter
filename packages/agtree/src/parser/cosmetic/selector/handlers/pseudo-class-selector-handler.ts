import { sprintf } from 'sprintf-js';

import { getFormattedTokenName, TokenType } from '@adguard/css-tokenizer';

import { AdblockSyntaxError } from '../../../../errors/adblock-syntax-error';
import { type PseudoClassSelector } from '../../../../nodes';
import { ValueParser } from '../../../misc/value-parser';
import { type SelectorListParserContext } from '../context';

/**
 * Handles pseudo-class selector parsing in selector list.
 */
export class PseudoClassSelectorHandler {
    /**
     * Handles pseudo-class selector parsing by creating a pseudo-class selector node
     * and appending it to the current complex selector node.
     *
     * @param context Selector list parser context.
     *
     * @throws If the pseudo-class selector is syntactically incorrect.
     */
    public static handle(context: SelectorListParserContext): void {
        const {
            raw,
            options,
            baseOffset,
            stream,
            complexSelector,
        } = context;

        // Get colon token
        let token = stream.getOrFail();

        // Save pseudo-class selector node start position
        const { start } = token;

        // Advance colon token
        stream.advance();

        // Get pseudo-class selector name token
        token = stream.getOrFail();

        // It should be a function or identifier
        const isFunction = token.type === TokenType.Function;
        if (!isFunction && token.type !== TokenType.Ident) {
            throw new AdblockSyntaxError(
                sprintf(
                    // eslint-disable-next-line max-len
                    `Expected '${getFormattedTokenName(TokenType.Ident)}' or '${getFormattedTokenName(TokenType.Function)}' as pseudo-class selector name, but got '%s' with value '%s'`,
                    getFormattedTokenName(token.type),
                    stream.fragment(),
                ),
                baseOffset + token.start,
                baseOffset + token.end,
            );
        }

        // Extract pseudo-class selector name raw value
        let nameRaw: string;
        if (!isFunction) {
            nameRaw = raw.slice(token.start, token.end);
        } else {
            nameRaw = raw.slice(token.start, token.end - 1); // Exclude '('
        }

        // Construct pseudo-class selector node
        const result: PseudoClassSelector = {
            type: 'PseudoClassSelector',
            name: ValueParser.parse(
                nameRaw,
                options,
                baseOffset + token.start,
            ),
        };

        // Include pseudo-class selector node start location if needed
        if (options.isLocIncluded) {
            result.start = baseOffset + start;
        }

        // If it's a function, parse its argument
        if (isFunction) {
            // The argument is the raw text between the parentheses, with no
            // trimming (CoreLibs parity), so it starts right after the
            // opening parenthesis, whitespace included.
            const argumentStart = token.end;

            // Skip to the closing parenthesis. The function token is still the
            // current token here, so `skipUntilBalanced()` uses the function's
            // balance level and stops at the matching `)` even if the argument
            // contains nested balanced pairs, e.g. `:not([class])`.
            stream.skipUntilBalanced();

            // Get closing parenthesis token
            token = stream.getOrFail();

            // The argument ends right before the closing parenthesis
            const argumentEnd = token.start;

            // Extract pseudo-class selector argument raw value (not trimmed)
            // TODO: Consider parsing inner selectors (like :not(.class))
            const argumentRaw = raw.slice(argumentStart, argumentEnd);

            // Specify pseudo-class selector argument node value
            result.argument = {
                type: 'Value',
                value: argumentRaw,
            };

            // Include pseudo-class selector argument node location if needed
            if (options.isLocIncluded) {
                result.argument.start = baseOffset + argumentStart;
                result.argument.end = baseOffset + argumentEnd;
            }

            // Expect close parenthesis token
            stream.expect(TokenType.CloseParenthesis);
        }

        // Include pseudo-class selector end location if needed
        if (options.isLocIncluded) {
            result.end = baseOffset + token.end;
        }

        // Append pseudo-class selector node to the current complex selector node
        complexSelector.children.push(result);

        // Advance pseudo-class selector name token (if ident) or closing parenthesis token (if function)
        stream.advance();
    }
}
