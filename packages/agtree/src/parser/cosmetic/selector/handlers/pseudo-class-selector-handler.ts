import { getFormattedTokenName, TokenType } from '@adguard/css-tokenizer';
import { sprintf } from 'sprintf-js';

import { type PseudoClassSelector } from '../../../../nodes';
import { AdblockSyntaxError } from '../../../../errors/adblock-syntax-error';
import { EMPTY } from '../../../../utils/constants';
import { type TokenData } from '../../../css/css-token-stream';
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
            // Advance pseudo-class selector name token
            stream.advance();

            // Get pseudo-class selector argument token
            token = stream.getOrFail();

            // Construct empty pseudo-class selector argument node by default
            result.argument = {
                type: 'Value',
                value: EMPTY,
            };

            // Include pseudo-class selector argument node location if needed
            if (options.isLocIncluded) {
                result.argument.start = baseOffset + token.start;
                result.argument.end = baseOffset + token.start;
            }

            // Skip whitespaces after opening parenthesis
            stream.skipWhitespace();

            // Get pseudo-class selector argument or closing parenthesis token
            token = stream.getOrFail();

            // Check if there is any argument part
            if (token.type !== TokenType.CloseParenthesis) {
                // Save the balance level to find the matching closing parenthesis
                const balance = stream.getBalance();

                // Skip leading whitespace
                stream.skipWhitespace();

                // Get argument token
                token = stream.getOrFail();

                // Save pseudo-class selector argument start position
                const argumentStart = token.start;

                // Track last non-whitespace token to handle trailing whitespace
                let lastNonWsToken: TokenData | undefined;

                // Skip to the closing parenthesis at the matching balance level
                while (stream.get()?.balance !== balance - 1) {
                    const currentToken = stream.get();
                    if (currentToken && currentToken.type !== TokenType.Whitespace) {
                        lastNonWsToken = currentToken;
                    }
                    stream.advance();
                }

                // Get closing parenthesis token
                token = stream.getOrFail();

                // Save pseudo-class selector argument end position (after last non-whitespace token)
                const argumentEnd = lastNonWsToken ? lastNonWsToken.end : token.start;

                // Extract pseudo-class selector argument raw value (trimmed)
                // TODO: Consider parsing inner selectors (like :not(.class))
                const argumentRaw = raw.slice(argumentStart, argumentEnd);

                // Specify pseudo-class selector argument node value
                result.argument.value = argumentRaw;

                // Include pseudo-class selector argument node location if needed
                if (options.isLocIncluded) {
                    result.argument.start = baseOffset + argumentStart;
                    result.argument.end = baseOffset + argumentStart + argumentRaw.length;
                }
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
