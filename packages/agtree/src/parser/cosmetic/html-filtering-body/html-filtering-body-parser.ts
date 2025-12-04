import { getFormattedTokenName, TokenType } from '@adguard/css-tokenizer';
import { sprintf } from 'sprintf-js';

import {
    type HtmlFilteringRuleSelector,
    type HtmlFilteringRuleBody,
    type HtmlFilteringRuleSelectorList,
    type HtmlFilteringRuleSelectorAttribute,
    type HtmlFilteringRuleSelectorPseudoClass,
} from '../../../nodes';
import { BaseParser } from '../../base-parser';
import { CssTokenStream, type TokenData } from '../../css/css-token-stream';
import { defaultParserOptions, type ParserOptions } from '../../options';
import { QuoteType, QuoteUtils } from '../../../utils/quotes';
import {
    ASTERISK,
    CARET,
    COMMA,
    DOLLAR_SIGN,
    DOT,
    DOUBLE_QUOTE,
    EQUALS,
    GREATER_THAN,
    PIPE,
    PLUS,
    SINGLE_QUOTE,
    SPACE,
    TILDE,
} from '../../../utils/constants';
import { ValueParser } from '../../misc/value-parser';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';

/**
 * Class responsible for parsing HTML filtering rule body.
 *
 * Please note that the parser will parse any HTML filtering rule body if it is syntactically correct.
 * For example, it will parse this:
 * ```adblock
 * span[special-attr="Example"]
 * div:special-pseudo(Example)
 * ```
 *
 * but it didn't check if the pseudo selector `special-pseudo` or if
 * the attribute selector `special-attr` actually supported by any adblocker.
 *
 * @see {@link https://www.w3.org/TR/selectors-4}
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#html-filtering-rules}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#html-filters}
 */
export class HtmlFilteringBodyParser extends BaseParser {
    /**
     * Error messages used in the parser.
     */
    private static readonly ERROR_MESSAGES = {
        UNEXPECTED_TOKEN_WITH_VALUE: "Unexpected token '%s' with value '%s'",
        TAG_NAME_ALREADY_SET: 'Tag name is already set for the selector',
        TAG_NAME_MUST_BE_FIRST: 'Tag name must be the first part of the selector',
        // eslint-disable-next-line max-len
        INVALID_ATTRIBUTE_VALUE: `Expected '${getFormattedTokenName(TokenType.Ident)}' or '${getFormattedTokenName(TokenType.String)}' as attribute value, but got '%s' with value '%s'`,
        INVALID_ATTRIBUTE_OPERATOR: "Invalid attribute operator '%s'",
        // eslint-disable-next-line max-len
        INVALID_PSEUDO_CLASS_NAME: `Expected '${getFormattedTokenName(TokenType.Ident)}' or '${getFormattedTokenName(TokenType.Function)}' as pseudo class name, but got '%s' with value '%s'`,
    };

    /**
     * Set of attribute equality prefixes.
     */
    private static readonly ATTR_EQUALITY_PREFIXES = new Set([
        // [attr~="value"]
        TILDE,

        // [attr^="value"]
        CARET,

        // [attr$="value"]
        DOLLAR_SIGN,

        // [attr*="value"]
        ASTERISK,

        // [attr|="value"]
        PIPE,
    ]);

    /**
     * Allowed combinator symbols between selectors.
     */
    private static readonly ALLOWED_SYMBOLS_BETWEEN_SELECTORS = new Set([
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
     * Parses a HTML filtering rule body.
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
     * span[tag-content="Example"]
     * div:has-text(Example)
     * ```
     */
    public static parse(
        raw: string,
        options = defaultParserOptions,
        baseOffset = 0,
    ): HtmlFilteringRuleBody {
        // Construct body node
        const result: HtmlFilteringRuleBody = {
            type: 'HtmlFilteringRuleBody',
            children: [],
        };

        // Include body location if needed
        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        // Construct the stream
        const stream = new CssTokenStream(raw, baseOffset);

        // Skip whitespaces before first token
        stream.skipWhitespace();

        // Get first token
        let token = stream.getOrFail();

        // Construct first selector list node
        let currentSelectorList: HtmlFilteringRuleSelectorList = {
            type: 'HtmlFilteringRuleSelectorList',
            children: [],
        };

        // Construct first selector node
        let currentSelector: HtmlFilteringRuleSelector = {
            type: 'HtmlFilteringRuleSelector',
            children: [],
        };

        // Track if current selector tag name is set
        let isCurrentSelectorTagNameSet = false;

        // Include selector list and selector start location if needed
        if (options.isLocIncluded) {
            currentSelectorList.start = baseOffset + token.start;
            currentSelector.start = baseOffset + token.start;
        }

        /**
         * Finishes the current selector by appending it to the current selector list,
         * then constructs a new selector node with an optional combinator.
         *
         * @param currentToken Current token where we are at in the stream.
         * @param previousEndToken End token of the previous selector.
         * @param nextStartToken Start token of the next selector.
         * @param combinatorToken Optional combinator token.
         * @param combinator Optional combinator string.
         *
         * @throws If the current selector has no parts.
         */
        const finishCurrentSelector = (
            currentToken: TokenData,
            previousEndToken: TokenData | undefined,
            nextStartToken: TokenData,
            combinatorToken?: TokenData,
            combinator?: string,
        ): void => {
            // Throw error if current selector has no parts
            if (!previousEndToken || currentSelector.children.length === 0) {
                throw new AdblockSyntaxError(
                    sprintf(
                        HtmlFilteringBodyParser.ERROR_MESSAGES.UNEXPECTED_TOKEN_WITH_VALUE,
                        getFormattedTokenName(currentToken.type),
                        raw.slice(currentToken.start, currentToken.end),
                    ),
                    baseOffset + currentToken.start,
                    baseOffset + currentToken.end,
                );
            }

            // Include selector end location if needed
            if (options.isLocIncluded) {
                currentSelector.end = baseOffset + previousEndToken.end;
            }

            // Append current selector to current selector list
            currentSelectorList.children.push(currentSelector);

            // Construct new selector node
            currentSelector = {
                type: 'HtmlFilteringRuleSelector',
                children: [],
            };

            // Include selector start location if needed
            if (options.isLocIncluded) {
                currentSelector.start = baseOffset + nextStartToken.start;
            }

            if (combinatorToken && combinator) {
                currentSelector.combinator = ValueParser.parse(
                    combinator,
                    options,
                    baseOffset + combinatorToken.start,
                );
            }

            // Reset tag name set tracker for new selector
            isCurrentSelectorTagNameSet = false;
        };

        /**
         * Finishes the current selector and selector list by:
         * - Finishing current selector with `finishCurrentSelector()`,
         * - And appending current selector list to the body.
         *
         * @param currentToken Current token where we are at in the stream.
         * @param previousEndToken End token of the previous selector.
         * @param nextStartToken Start token of the next selector.
         *
         * @throws If the current selector has no parts.
         */
        const finishCurrentSelectorList = (
            currentToken: TokenData,
            previousEndToken: TokenData | undefined,
            nextStartToken: TokenData,
        ): void => {
            // Finish current selector
            finishCurrentSelector(currentToken, previousEndToken, nextStartToken);

            // Throw error if current selector list has no selectors
            if (!previousEndToken || currentSelectorList.children.length === 0) {
                throw new AdblockSyntaxError(
                    sprintf(
                        HtmlFilteringBodyParser.ERROR_MESSAGES.UNEXPECTED_TOKEN_WITH_VALUE,
                        getFormattedTokenName(currentToken.type),
                        raw.slice(currentToken.start, currentToken.end),
                    ),
                    baseOffset + currentToken.start,
                    baseOffset + currentToken.end,
                );
            }

            // Include selector list end location if needed
            if (options.isLocIncluded) {
                currentSelectorList.end = baseOffset + previousEndToken.end;
            }

            // Append current selector list to body
            result.children.push(currentSelectorList);

            // Construct new selector list node
            currentSelectorList = {
                type: 'HtmlFilteringRuleSelectorList',
                children: [],
            };

            if (options.isLocIncluded) {
                currentSelectorList.start = baseOffset + nextStartToken.start;
            }
        };

        // Traverse the stream
        while (!stream.isEof()) {
            // Get next token
            token = stream.getOrFail();

            switch (token.type) {
                // Tag name
                case TokenType.Ident: {
                    // Throw error if tag name is already set
                    if (isCurrentSelectorTagNameSet) {
                        throw new AdblockSyntaxError(
                            HtmlFilteringBodyParser.ERROR_MESSAGES.TAG_NAME_ALREADY_SET,
                            baseOffset + token.start,
                            baseOffset + token.end,
                        );
                    }

                    // Throw error if tag name isn't first part of the selector
                    if (currentSelector.children.length > 0) {
                        throw new AdblockSyntaxError(
                            HtmlFilteringBodyParser.ERROR_MESSAGES.TAG_NAME_MUST_BE_FIRST,
                            baseOffset + token.start,
                            baseOffset + token.end,
                        );
                    }

                    // Mark that tag name is set
                    isCurrentSelectorTagNameSet = true;

                    HtmlFilteringBodyParser.handleTagName(
                        stream,
                        currentSelector,
                        options,
                        baseOffset,
                    );

                    break;
                }

                // ID
                case TokenType.Hash: {
                    HtmlFilteringBodyParser.handleId(
                        stream,
                        currentSelector,
                        options,
                        baseOffset,
                    );
                    break;
                }

                // Attribute
                case TokenType.OpenSquareBracket: {
                    HtmlFilteringBodyParser.handleAttribute(
                        stream,
                        currentSelector,
                        options,
                        baseOffset,
                    );
                    break;
                }

                // Pseudo class
                case TokenType.Colon: {
                    HtmlFilteringBodyParser.handlePseudoClass(
                        raw,
                        stream,
                        currentSelector,
                        options,
                        baseOffset,
                    );
                    break;
                }

                // Class name ('.'), Combinators ('>', '+', '~')
                case TokenType.Delim: {
                    // Get delimiter value
                    const delim = stream.fragment();

                    switch (delim) {
                        // Class name
                        case DOT: {
                            HtmlFilteringBodyParser.handleClassName(
                                stream,
                                currentSelector,
                                options,
                                baseOffset,
                            );
                            break;
                        }

                        // Combinators
                        case GREATER_THAN:
                        case PLUS:
                        case TILDE: {
                            // Save previous selector end token
                            const previousEndToken = stream.lookbehindForNonWs();

                            // Save delimiter (combinator) token
                            const delimToken = token;

                            // Advance combinator token
                            stream.advance();

                            // Skip whitespaces after combinator
                            stream.skipWhitespace();

                            // Save next selector start token
                            const nextStartToken = stream.getOrFail();

                            // Finish current selector with combinator
                            finishCurrentSelector(
                                delimToken,
                                previousEndToken,
                                nextStartToken,
                                delimToken,
                                delim,
                            );

                            break;
                        }

                        default: {
                            throw new AdblockSyntaxError(
                                sprintf(
                                    HtmlFilteringBodyParser.ERROR_MESSAGES.UNEXPECTED_TOKEN_WITH_VALUE,
                                    getFormattedTokenName(token.type),
                                    delim,
                                ),
                                baseOffset + token.start,
                                baseOffset + token.end,
                            );
                        }
                    }

                    break;
                }

                // End of current selector (whitespace combinator - descendant)
                case TokenType.Whitespace: {
                    // Save previous selector end token
                    const previousEndToken = stream.lookbehindForNonWs();

                    // Save space (combinator) token
                    const spaceToken = token;

                    // Skip all whitespaces
                    stream.skipWhitespace();

                    // Get next token (it can be EOF, combinator or comma)
                    const nextStartToken = stream.get();

                    // EOF - just exit
                    if (!nextStartToken) {
                        break;
                    }

                    // Combinator or comma - just skip, we shouldn't consider it as descendant combinator
                    const possibleCombinatorOrComma = stream.fragment();
                    if (HtmlFilteringBodyParser.ALLOWED_SYMBOLS_BETWEEN_SELECTORS.has(possibleCombinatorOrComma)) {
                        break;
                    }

                    // Finish current selector with whitespace combinator
                    finishCurrentSelector(
                        spaceToken,
                        previousEndToken,
                        nextStartToken,
                        spaceToken,
                        SPACE,
                    );

                    break;
                }

                // End of current selector list
                case TokenType.Comma: {
                    // Save previous selector end token
                    const previousEndToken = stream.lookbehindForNonWs();

                    // Save comma token
                    const commaToken = token;

                    // Advance comma token
                    stream.advance();

                    // Skip whitespaces after comma
                    stream.skipWhitespace();

                    // Save next selector start token
                    const nextStartToken = stream.getOrFail();

                    // Finish current selector list
                    finishCurrentSelectorList(commaToken, previousEndToken, nextStartToken);

                    break;
                }

                default: {
                    throw new AdblockSyntaxError(
                        sprintf(
                            HtmlFilteringBodyParser.ERROR_MESSAGES.UNEXPECTED_TOKEN_WITH_VALUE,
                            getFormattedTokenName(token.type),
                            stream.fragment(),
                        ),
                        baseOffset + token.start,
                        baseOffset + token.end,
                    );
                }
            }
        }

        // Save last non-whitespace token
        const lastNonWsToken = stream.lookbehindForNonWs();

        // If last non-whitespace token is not found,
        // throw error because it means that there are 0 tokens in the stream
        if (!lastNonWsToken) {
            throw new AdblockSyntaxError(
                sprintf(
                    HtmlFilteringBodyParser.ERROR_MESSAGES.UNEXPECTED_TOKEN_WITH_VALUE,
                    getFormattedTokenName(TokenType.Eof),
                    raw,
                ),
                baseOffset,
                baseOffset + raw.length,
            );
        }

        // Finish last selector list
        finishCurrentSelectorList(lastNonWsToken, lastNonWsToken, lastNonWsToken);

        return result;
    }

    /**
     * Handles tag name parsing by creating a tag name node and appending it to the given selector.
     *
     * @param stream Token stream.
     * @param selector Selector node to append the tag name node to.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     */
    private static handleTagName(
        stream: CssTokenStream,
        selector: HtmlFilteringRuleSelector,
        options: ParserOptions,
        baseOffset: number,
    ): void {
        // Get token (tag name)
        const token = stream.getOrFail();

        // Extract tag name raw value
        const tagNameRaw = stream.fragment();

        // Construct tag name node
        const tagNameNode = ValueParser.parse(
            tagNameRaw,
            options,
            baseOffset + token.start,
        );

        // Append tag name node to selector parts
        selector.children.push(tagNameNode);

        // Advance tag name token
        stream.advance();
    }

    /**
     * Handles ID parsing by creating an ID node and appending it to the given selector.
     *
     * @param stream Token stream.
     * @param selector Selector node to append the ID node to.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     */
    private static handleId(
        stream: CssTokenStream,
        selector: HtmlFilteringRuleSelector,
        options: ParserOptions,
        baseOffset: number,
    ): void {
        // Get token (ID)
        const token = stream.getOrFail();

        // Extract ID raw value with hashmark
        const idRaw = stream.fragment();

        // Construct ID node
        const idNode = ValueParser.parse(
            idRaw,
            options,
            baseOffset + token.start,
        );

        // Append ID node to selector parts
        selector.children.push(idNode);

        // Advance ID token
        stream.advance();
    }

    /**
     * Handles class name parsing by creating an class name node and appending it to the given selector.
     *
     * @param stream Token stream.
     * @param selector Selector node to append the class name node to.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     */
    private static handleClassName(
        stream: CssTokenStream,
        selector: HtmlFilteringRuleSelector,
        options: ParserOptions,
        baseOffset: number,
    ): void {
        // Get token (dot)
        const token = stream.getOrFail();

        // Advance dot token
        stream.advance();

        // Expect next token to be an identifier (class name)
        stream.expect(TokenType.Ident);

        // Extract class name raw value (without dot)
        const classNameRaw = stream.fragment();

        // Construct class name node
        const classNameNode = ValueParser.parse(
            DOT + classNameRaw,
            options,
            baseOffset + token.start,
        );

        // Append class name node to selector parts
        selector.children.push(classNameNode);

        // Advance class name token
        stream.advance();
    }

    /**
     * Handles attribute parsing by creating an attribute node and appending it to the given selector.
     *
     * @param stream Token stream.
     * @param selector Selector node to append the attribute node to.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     */
    private static handleAttribute(
        stream: CssTokenStream,
        selector: HtmlFilteringRuleSelector,
        options: ParserOptions,
        baseOffset: number,
    ): void {
        // Get token (open square bracket)
        let token = stream.getOrFail();

        // Save attribute start position
        const attributeStart = token.start;

        // Advance open square bracket token
        stream.advance();

        // Skip whitespaces after open square bracket
        stream.skipWhitespace();

        // Expect next token to be an identifier (attribute name)
        stream.expect(TokenType.Ident);

        // Get next token (attribute name)
        token = stream.getOrFail();

        // Extract attribute name raw value
        const attributeNameRaw = stream.fragment();

        // Construct attribute name node
        const attributeNameNode = ValueParser.parse(
            attributeNameRaw,
            options,
            baseOffset + token.start,
        );

        // Construct attribute node
        const attributeNode: HtmlFilteringRuleSelectorAttribute = {
            type: 'HtmlFilteringRuleSelectorAttribute',
            name: attributeNameNode,
        };

        // Include attribute start location if needed
        if (options.isLocIncluded) {
            attributeNode.start = baseOffset + attributeStart;
        }

        // Advance attribute name token
        stream.advance();

        // Skip whitespaces after attribute name
        stream.skipWhitespace();

        // Get next token (closing square bracket or equality prefix/sign)
        token = stream.getOrFail();

        // Check if there is an any value part
        if (token.type !== TokenType.CloseSquareBracket) {
            // If it is not a close square bracket, expect a delimiter (equality prefix or equal sign)
            stream.expect(TokenType.Delim);

            // Get operator raw value
            let operatorRaw = stream.fragment();

            // Check if it's prefix operator
            if (HtmlFilteringBodyParser.ATTR_EQUALITY_PREFIXES.has(operatorRaw)) {
                // Advance prefix operator token
                stream.advance();

                // Expect equal sign token
                stream.expect(TokenType.Delim, { value: EQUALS });

                // Append equal sign to operator raw value
                operatorRaw += EQUALS;
            } else if (operatorRaw !== EQUALS) {
                // If it's not equal sign either, throw error
                throw new AdblockSyntaxError(
                    sprintf(
                        HtmlFilteringBodyParser.ERROR_MESSAGES.INVALID_ATTRIBUTE_OPERATOR,
                        operatorRaw,
                    ),
                    baseOffset + token.start,
                    baseOffset + token.end,
                );
            }

            // Construct operator node
            attributeNode.operator = ValueParser.parse(
                operatorRaw,
                options,
                baseOffset + token.start,
            );

            // Advance equal sign token
            stream.advance();

            // Skip whitespaces after equal sign
            stream.skipWhitespace();

            // Get next token (attribute value)
            token = stream.getOrFail();

            // It should be a string or identifier
            const isValueString = token.type === TokenType.String;
            if (!isValueString && token.type !== TokenType.Ident) {
                throw new AdblockSyntaxError(
                    sprintf(
                        HtmlFilteringBodyParser.ERROR_MESSAGES.INVALID_ATTRIBUTE_VALUE,
                        getFormattedTokenName(token.type),
                        stream.fragment(),
                    ),
                    baseOffset + token.start,
                    baseOffset + token.end,
                );
            }

            // Extract attribute value raw value
            const attributeValueRaw = stream.fragment();

            // Get quote type of the attribute value
            const quoteType = QuoteUtils.getStringQuoteType(attributeValueRaw);

            // We should unescape respective quotes inside of the string value
            let attributeValueUnescaped: string;
            switch (quoteType) {
                // [attr='value \\' test'] -> value ' test
                case QuoteType.Single:
                    attributeValueUnescaped = QuoteUtils.unescapeSingleEscapedOccurrences(
                        attributeValueRaw.slice(1, -1), // Remove surrounding quotes
                        SINGLE_QUOTE,
                    );
                    break;

                // [attr="value \\" test"] -> value " test
                case QuoteType.Double:
                    attributeValueUnescaped = QuoteUtils.unescapeSingleEscapedOccurrences(
                        attributeValueRaw.slice(1, -1), // Remove surrounding quotes
                        DOUBLE_QUOTE,
                    );
                    break;

                // No quotes - no need to unescape anything
                // Backticks are not supported in CSS selectors
                default:
                    attributeValueUnescaped = attributeValueRaw;
                    break;
            }

            // Construct attribute value node
            attributeNode.value = ValueParser.parse(
                attributeValueUnescaped,
                options,
                // Calculate attribute value start position (+1 if string to skip starting quote)
                baseOffset + token.start + (isValueString ? 1 : 0),
            );

            // Since quotes might be unescaped inside of the string,
            // we need to calculate the correct end position of the attribute value node
            attributeNode.value.end = baseOffset + token.end - (isValueString ? 1 : 0);

            // Advance attribute value token
            stream.advance();

            // Skip whitespaces after attribute value
            stream.skipWhitespace();

            // Get next token (close square bracket or flag)
            token = stream.getOrFail();

            // Check if there is an any flag part
            if (token.type !== TokenType.CloseSquareBracket) {
                // If it is not a close square bracket, expect a identifier (flag)
                stream.expect(TokenType.Ident);

                // Extract flag raw value
                const flagRaw = stream.fragment();

                // Construct flag node
                attributeNode.flag = ValueParser.parse(
                    flagRaw,
                    options,
                    baseOffset + token.start,
                );

                // Advance flag token
                stream.advance();

                // Skip whitespaces after flag
                stream.skipWhitespace();

                // Get next token (close square bracket)
                token = stream.getOrFail();
            }
        }

        // Expect close square bracket token
        stream.expect(TokenType.CloseSquareBracket);

        // Include attribute end location if needed
        if (options.isLocIncluded) {
            attributeNode.end = baseOffset + token.end;
        }

        // Append attribute node to selector parts
        selector.children.push(attributeNode);

        // Advance close square bracket token
        stream.advance();
    }

    /**
     * Handles pseudo class parsing by creating an pseudo class node and appending it to the given selector.
     *
     * @param raw Raw input to parse.
     * @param stream Token stream.
     * @param selector Selector node to append the pseudo class node to.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     */
    private static handlePseudoClass(
        raw: string,
        stream: CssTokenStream,
        selector: HtmlFilteringRuleSelector,
        options: ParserOptions,
        baseOffset: number,
    ): void {
        // Get token
        let token = stream.getOrFail();

        // Save pseudo class start position
        const pseudoClassStart = token.start;

        // Advance colon token
        stream.advance();

        // Get next token (pseudo class name)
        token = stream.getOrFail();

        // It should be a function or identifier
        const isPseudoClassNameFunction = token.type === TokenType.Function;
        if (!isPseudoClassNameFunction && token.type !== TokenType.Ident) {
            throw new AdblockSyntaxError(
                sprintf(
                    HtmlFilteringBodyParser.ERROR_MESSAGES.INVALID_PSEUDO_CLASS_NAME,
                    getFormattedTokenName(token.type),
                    stream.fragment(),
                ),
                baseOffset + token.start,
                baseOffset + token.end,
            );
        }

        // Extract pseudo class name raw value
        let pseudoClassNameRaw: string;
        if (!isPseudoClassNameFunction) {
            pseudoClassNameRaw = raw.slice(token.start, token.end);
        } else {
            pseudoClassNameRaw = raw.slice(token.start, token.end - 1); // Exclude '('
        }

        // Construct pseudo class name node
        const pseudoClassNameNode = ValueParser.parse(
            pseudoClassNameRaw,
            options,
            baseOffset + token.start,
        );

        // Construct pseudo class node
        const pseudoClassNode: HtmlFilteringRuleSelectorPseudoClass = {
            type: 'HtmlFilteringRuleSelectorPseudoClass',
            name: pseudoClassNameNode,
            isFunction: isPseudoClassNameFunction,
        };

        // Include pseudo class start location if needed
        if (options.isLocIncluded) {
            pseudoClassNode.start = baseOffset + pseudoClassStart;
        }

        // If it's a function, parse its argument
        if (isPseudoClassNameFunction) {
            // Advance pseudo class name token
            stream.advance();

            // Skip whitespaces after opening parenthesis
            stream.skipWhitespace();

            // Get next token (argument or closing parenthesis)
            token = stream.getOrFail();

            // Check if there is an any argument part
            if (token.type !== TokenType.CloseParenthesis) {
                // Save pseudo class argument start position
                const pseudoClassArgumentStart = token.start;

                // Skip until closing parenthesis
                stream.skipUntilBalanced();

                // Get next token (closing parenthesis)
                token = stream.getOrFail();

                // Save pseudo class argument end position (ends before closing parenthesis)
                const pseudoClassArgumentEnd = token.start;

                // Extract pseudo class argument raw value
                const pseudoClassArgumentRaw = raw
                    .slice(pseudoClassArgumentStart, pseudoClassArgumentEnd)
                    .trimEnd();

                // Construct pseudo class argument node
                pseudoClassNode.argument = ValueParser.parse(
                    pseudoClassArgumentRaw,
                    options,
                    baseOffset + pseudoClassArgumentStart,
                );
            }

            // Expect close parenthesis token
            stream.expect(TokenType.CloseParenthesis);
        }

        // Include pseudo class end location if needed
        if (options.isLocIncluded) {
            pseudoClassNode.end = baseOffset + token.end;
        }

        // Append pseudo class node to selector parts
        selector.children.push(pseudoClassNode);

        // Advance pseudo class name token (if ident) or function closing parenthesis token (if function)
        stream.advance();
    }
}
