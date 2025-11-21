import { getFormattedTokenName, TokenType } from '@adguard/css-tokenizer';
import { sprintf } from 'sprintf-js';

import {
    type HtmlFilteringRuleSelector,
    type HtmlFilteringRuleBody,
    type HtmlFilteringRuleSelectorAttribute,
} from '../../../nodes';
import { BaseParser } from '../../base-parser';
import { CssTokenStream } from '../../css/css-token-stream';
import { defaultParserOptions } from '../../options';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { ValueParser } from '../../misc/value-parser';
import { EQUALS } from '../../../utils/constants';
import { QuoteUtils } from '../../../utils/quotes';

/**
 * `AdgHtmlFilteringBodyParser` is responsible for parsing the body of an AdGuard-style HTML filtering rule.
 *
 * Please note that the parser will parse any HTML filtering rule if it is syntactically correct.
 * For example, it will parse this:
 * ```adblock
 * example.com$$div[special-attr="value"]
 * ```
 *
 * but it didn't check if the attribute `special-attr` actually supported by any adblocker.
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#html-filtering-rules}
 */
export class AdgHtmlFilteringBodyParser extends BaseParser {
    /**
     * Error messages used in the parser.
     */
    private static readonly ERROR_MESSAGES = {
        UNEXPECTED_TOKEN_WITH_VALUE: "Unexpected token '%s' with value '%s'",
        INVALID_ATTRIBUTE_NAME: "Attribute name should be an identifier, but got '%s' with value '%s'",
        // eslint-disable-next-line max-len
        INVALID_ATTRIBUTE_VALUE: `Expected '${getFormattedTokenName(TokenType.Ident)}' or '${getFormattedTokenName(TokenType.String)}' as attribute value, but got '%s' with value '%s'`,
        TAG_SHOULD_BE_FIRST_CHILD: "Unexpected token '%s' with value '%s', tag selector should be the first child",
        EMPTY_BODY: 'HTML filtering rule body cannot be empty',
    };

    /**
     * Parses the body of an AdGuard-style HTML filtering rule.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @returns Node of the parsed HTML filtering rule body.
     *
     * @throws If the body is syntactically incorrect.
     *
     * @example
     * ```
     * div[some_attribute="some_value"]
     * ```
     *
     * @todo TODO: Add support for child selectors (AG-43974).
     * @todo TODO: Add support for pseudo-classes (AG-43975).
     */
    public static parse(
        raw: string,
        options = defaultParserOptions,
        baseOffset = 0,
    ): HtmlFilteringRuleBody {
        // Escape "" in the raw input to handle them correctly
        const escapedRaw = QuoteUtils.escapeDoubleQuotes(raw);

        // Construct the selector node
        const selector: HtmlFilteringRuleSelector = {
            type: 'HtmlFilteringRuleSelector',
            attributes: [],
            pseudoClasses: [],
        };

        // Construct the body node
        const result: HtmlFilteringRuleBody = {
            type: 'HtmlFilteringRuleBody',
            selectors: [selector],
        };

        // Include location info if needed
        // We set the selector location to be the same as the body location
        // because AdGuard-style HTML filtering rules only support one selector
        if (options.isLocIncluded) {
            selector.start = baseOffset;
            selector.end = baseOffset + raw.length;
            result.start = selector.start;
            result.end = selector.end;
        }

        const stream = new CssTokenStream(escapedRaw, baseOffset);

        // Skip leading whitespace
        stream.skipWhitespace();

        while (!stream.isEof()) {
            let token = stream.getOrFail();

            if (token.type === TokenType.Whitespace) {
                // Skip whitespace
                stream.advance();
            } else if (token.type === TokenType.Ident) {
                // Tag name

                // Throw error if tag name is already defined
                // It can happen in cases like: `div[attr="value"]span`, `div span[attr="value"]`
                if (selector.tagName !== undefined) {
                    throw new AdblockSyntaxError(
                        sprintf(
                            AdgHtmlFilteringBodyParser.ERROR_MESSAGES.UNEXPECTED_TOKEN_WITH_VALUE,
                            getFormattedTokenName(token.type),
                            stream.fragment(),
                        ),
                        token.start + baseOffset,
                        token.end + baseOffset,
                    );
                }

                // Throw error if there are already attributes defined
                // It can happen in cases like: `[attr="value"]div`
                if (selector.attributes.length > 0) {
                    throw new AdblockSyntaxError(
                        sprintf(
                            AdgHtmlFilteringBodyParser.ERROR_MESSAGES.TAG_SHOULD_BE_FIRST_CHILD,
                            getFormattedTokenName(token.type),
                            stream.fragment(),
                        ),
                        token.start + baseOffset,
                        token.end + baseOffset,
                    );
                }

                // Construct the tag name node
                selector.tagName = ValueParser.parse(
                    stream.fragment(),
                    options,
                    token.start + baseOffset,
                );

                // Advance the stream
                stream.advance();
            } else if (token.type === TokenType.OpenSquareBracket) {
                // Attribute

                // Save the attribute start offset (starts with open square bracket)
                const attributeStartOffset = token.start;

                // Consume opening square bracket
                stream.advance();

                // Skip optional whitespace
                stream.skipWhitespace();

                // Get next token (attribute name) and expect it to be an ident
                token = stream.getOrFail();
                if (token.type !== TokenType.Ident) {
                    throw new AdblockSyntaxError(
                        sprintf(
                            AdgHtmlFilteringBodyParser.ERROR_MESSAGES.INVALID_ATTRIBUTE_NAME,
                            getFormattedTokenName(token.type),
                            stream.fragment(),
                        ),
                        token.start + baseOffset,
                        token.end + baseOffset,
                    );
                }

                // Construct the attribute node
                const attribute: HtmlFilteringRuleSelectorAttribute = {
                    type: 'HtmlFilteringRuleSelectorAttribute',
                    name: ValueParser.parse(
                        stream.fragment(),
                        options,
                        token.start + baseOffset,
                    ),
                };

                // Add attribute to the selector
                selector.attributes.push(attribute);

                // Advance the stream
                stream.advance();

                // Skip optional whitespace
                stream.skipWhitespace();

                // Token can be with value
                token = stream.getOrFail();
                if (token.type !== TokenType.CloseSquareBracket) {
                    // Expect equals operator for attribute with value
                    stream.expect(TokenType.Delim, { value: EQUALS });
                    stream.advance();

                    // Skip optional whitespace
                    stream.skipWhitespace();

                    // Get next token (attribute value) and expect it to be an ident or string
                    token = stream.getOrFail();
                    if (token.type !== TokenType.Ident && token.type !== TokenType.String) {
                        throw new AdblockSyntaxError(
                            sprintf(
                                AdgHtmlFilteringBodyParser.ERROR_MESSAGES.INVALID_ATTRIBUTE_VALUE,
                                getFormattedTokenName(token.type),
                                stream.fragment(),
                            ),
                            token.start + baseOffset,
                            token.end + baseOffset,
                        );
                    }

                    // Construct the attribute value node
                    attribute.value = ValueParser.parse(
                        QuoteUtils.removeQuotes(stream.fragment()),
                        options,
                        token.start + baseOffset + (token.type === TokenType.String ? 1 : 0),
                    );

                    // Advance the stream
                    stream.advance();

                    // Skip optional whitespace
                    stream.skipWhitespace();
                }

                // Expect closing square bracket
                token = stream.getOrFail();
                stream.expect(TokenType.CloseSquareBracket);
                stream.advance();

                // Specify attribute location if needed
                if (options.isLocIncluded) {
                    attribute.start = attributeStartOffset + baseOffset;
                    attribute.end = token.end + baseOffset;
                }
            } else {
                // Throw error for unexpected tokens
                throw new AdblockSyntaxError(
                    sprintf(
                        AdgHtmlFilteringBodyParser.ERROR_MESSAGES.UNEXPECTED_TOKEN_WITH_VALUE,
                        getFormattedTokenName(token.type),
                        stream.fragment(),
                    ),
                    token.start + baseOffset,
                    token.end + baseOffset,
                );
            }
        }

        // Throw error if no tag name or attributes were defined
        if (selector.tagName === undefined && selector.attributes.length === 0) {
            throw new AdblockSyntaxError(
                AdgHtmlFilteringBodyParser.ERROR_MESSAGES.EMPTY_BODY,
                baseOffset,
                baseOffset + raw.length,
            );
        }

        return result;
    }
}
