import { getFormattedTokenName, TokenType } from '@adguard/css-tokenizer';
import { sprintf } from 'sprintf-js';

import {
    type CssAttributeSelector,
    type CssAttributeSelectorOperator,
    type CssComplexSelector,
    type CssComplexSelectorItem,
    type CssCompoundSelector,
    type CssPseudoClassSelector,
    type CssSelectorCombinator,
    type CssSelectorList,
} from '../../../nodes';
import { BaseParser } from '../../base-parser';
import { CssTokenStream, type TokenData } from '../../css/css-token-stream';
import { defaultParserOptions, type ParserOptions } from '../../options';
import {
    ASTERISK,
    CARET,
    COMMA,
    DOLLAR_SIGN,
    DOT,
    EMPTY,
    EQUALS,
    GREATER_THAN,
    PIPE,
    PLUS,
    SPACE,
    TILDE,
} from '../../../utils/constants';
import { ValueParser } from '../../misc/value-parser';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { QuoteUtils } from '../../../utils/quotes';

/**
 * Class responsible for parsing CSS selector lists.
 *
 * Please note that the parser will parse any CSS selector list if it is syntactically correct.
 * For example, it will parse this:
 * ```adblock
 * div[attr1="value1"] > h1[attr2="value2"], span[attr3="value3"]
 * ```
 *
 * but it didn't check if the given attribute or pseudo-class is valid or not.
 *
 * @see {@link https://www.w3.org/TR/selectors-4/#selector-list}
 */
export class CssSelectorListParser extends BaseParser {
    /**
     * Common error messages used in the parser for unexpected tokens.
     */
    private static readonly UNEXPECTED_TOKEN_WITH_VALUE_ERROR = "Unexpected token '%s' with value '%s'";

    /**
     * Set of attribute equality prefixes.
     *
     * @see {@link CssAttributeSelectorOperator}
     */
    private static readonly ATTR_EQUALITY_PREFIXES: ReadonlySet<string> = new Set([
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
     * Set of allowed symbols between selectors (combinators + comma, except <space> combinator).
     *
     * @see {@link CssSelectorCombinator}
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
     * Set of valid flags for attribute selector values.
     *
     * @see {@link CssSelectorListParser.CASE_INSENSITIVE_FLAG}
     * @see {@link CssSelectorListParser.CASE_SENSITIVE_FLAG}
     */
    private static readonly ALLOWED_ATTRIBUTE_FLAGS: ReadonlySet<string> = new Set([
        CssSelectorListParser.CASE_INSENSITIVE_FLAG,
        CssSelectorListParser.CASE_SENSITIVE_FLAG,
    ]);

    /**
     * Parses a CSS selector list.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @returns Node of the parsed CSS selector list.
     *
     * @throws If the CSS selector list is syntactically incorrect.
     *
     * @example
     * ```
     * div[attr1="value1"] > h1[attr2="value2"], span[attr3="value3"]
     * ```
     */
    public static parse(
        raw: string,
        options = defaultParserOptions,
        baseOffset = 0,
    ): CssSelectorList {
        // Construct selector list node
        const result: CssSelectorList = {
            type: 'CssSelectorList',
            children: [],
        };

        // Include selector list node locations if needed
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

        // Construct first complex selector node
        let currentComplexSelector: CssComplexSelector = {
            type: 'CssComplexSelector',
            children: [],
        };

        // Construct first complex selector item node and first compound selector node
        let currentComplexSelectorItem: CssComplexSelectorItem = {
            type: 'CssComplexSelectorItem',
            selector: {
                type: 'CssCompoundSelector',
                children: [],
            },
        };

        // Track if tag selector set in the current compound selector
        let isTagSelectorSetInCurrentCompoundSelector = false;

        // Include start locations for (if needed):
        // - first complex selector node
        // - first complex selector item node
        // - first compound selector node
        if (options.isLocIncluded) {
            currentComplexSelector.start = baseOffset + token.start;
            currentComplexSelectorItem.start = baseOffset + token.start;
            currentComplexSelectorItem.selector.start = baseOffset + token.start;
        }

        /**
         * Finishes the current complex selector item by:
         * 1. Validating current compound selector,
         * 2. Appending current complex selector item to the current complex selector,
         * 3. Constructing new compound selector,
         * 4. Constructing new complex selector item with the new compound selector (step 3),
         * 5. And setting combinator if provided.
         *
         * @param currentToken Current token where we are at in the stream.
         * @param currentEndToken End token of the current complex selector item.
         * @param nextStartToken Start token of the next complex selector item.
         * @param combinatorToken Optional combinator token.
         * @param combinator Optional combinator string.
         *
         * @throws If the current compound selector has no parts.
         */
        const finishCurrentComplexSelectorItem = (
            currentToken: TokenData,
            currentEndToken: TokenData | undefined,
            nextStartToken: TokenData,
            combinatorToken?: TokenData,
            combinator?: CssSelectorCombinator,
        ): void => {
            // Throw error if current compound selector has no simple selectors (empty)
            if (!currentEndToken || currentComplexSelectorItem.selector.children.length === 0) {
                throw new AdblockSyntaxError(
                    sprintf(
                        CssSelectorListParser.UNEXPECTED_TOKEN_WITH_VALUE_ERROR,
                        getFormattedTokenName(currentToken.type),
                        raw.slice(currentToken.start, currentToken.end),
                    ),
                    baseOffset + currentToken.start,
                    baseOffset + currentToken.end,
                );
            }

            // Include end locations for (if needed):
            // - current complex selector item node
            // - current compound selector node
            if (options.isLocIncluded) {
                currentComplexSelectorItem.end = baseOffset + currentEndToken.end;
                currentComplexSelectorItem.selector.end = baseOffset + currentEndToken.end;
            }

            // Append current complex selector item to current complex selector
            currentComplexSelector.children.push(currentComplexSelectorItem);

            // Construct next complex selector item node and next compound selector node
            currentComplexSelectorItem = {
                type: 'CssComplexSelectorItem',
                selector: {
                    type: 'CssCompoundSelector',
                    children: [],
                },
            };

            // Include start locations for (if needed):
            // - next complex selector item node
            // - next compound selector node
            if (options.isLocIncluded) {
                currentComplexSelectorItem.start = baseOffset + nextStartToken.start;
                currentComplexSelectorItem.selector.start = baseOffset + nextStartToken.start;
            }

            // Set combinator to next complex selector item if provided
            if (combinatorToken && combinator) {
                // Construct complex selector item combinator node
                currentComplexSelectorItem.combinator = {
                    type: 'Value',
                    value: combinator,
                };

                // Update complex selector item node start location if needed
                // And include complex selector item combinator node locations if needed
                if (options.isLocIncluded) {
                    currentComplexSelectorItem.start = baseOffset + combinatorToken.start;
                    currentComplexSelectorItem.combinator.start = baseOffset + combinatorToken.start;
                    currentComplexSelectorItem.combinator.end = baseOffset + combinatorToken.start + combinator.length;
                }
            }

            // Reset tag name set tracker for new selector
            isTagSelectorSetInCurrentCompoundSelector = false;
        };

        /**
         * Finishes the current complex selector by:
         * 1. Finishing current compound selector with `finishCurrentCompoundSelector()`,
         * 2. Validating current complex selector,
         * 3. Appending current complex selector to the selector list,
         * 4. Constructing new complex selector.
         *
         * @param currentToken Current token where we are at in the stream.
         * @param currentEndToken End token of the current complex selector.
         * @param nextStartToken Start token of the next complex selector.
         *
         * @throws If the current compound / complex selector has no parts.
         */
        const finishCurrentComplexSelector = (
            currentToken: TokenData,
            currentEndToken: TokenData | undefined,
            nextStartToken: TokenData,
        ): void => {
            // Finish current compound selector
            finishCurrentComplexSelectorItem(currentToken, currentEndToken, nextStartToken);

            // Throw error if current complex selector has no complex selector items (empty)
            if (!currentEndToken || currentComplexSelector.children.length === 0) {
                throw new AdblockSyntaxError(
                    sprintf(
                        CssSelectorListParser.UNEXPECTED_TOKEN_WITH_VALUE_ERROR,
                        getFormattedTokenName(currentToken.type),
                        raw.slice(currentToken.start, currentToken.end),
                    ),
                    baseOffset + currentToken.start,
                    baseOffset + currentToken.end,
                );
            }

            // Include current complex selector node end location if needed
            if (options.isLocIncluded) {
                currentComplexSelector.end = baseOffset + currentEndToken.end;
            }

            // Append current complex selector to selector list
            result.children.push(currentComplexSelector);

            // Construct next complex selector node
            currentComplexSelector = {
                type: 'CssComplexSelector',
                children: [],
            };

            // Include next complex selector node start location if needed
            if (options.isLocIncluded) {
                currentComplexSelector.start = baseOffset + nextStartToken.start;
            }
        };

        // Traverse the stream
        while (!stream.isEof()) {
            // Get next token
            token = stream.getOrFail();

            switch (token.type) {
                // Tag selector
                case TokenType.Ident: {
                    CssSelectorListParser.handleTagSelector(
                        stream,
                        currentComplexSelectorItem.selector,
                        options,
                        baseOffset,
                        isTagSelectorSetInCurrentCompoundSelector,
                    );

                    // Mark that tag name is set
                    isTagSelectorSetInCurrentCompoundSelector = true;

                    break;
                }

                // ID selector
                case TokenType.Hash: {
                    CssSelectorListParser.handleIdSelector(
                        stream,
                        currentComplexSelectorItem.selector,
                        options,
                        baseOffset,
                    );
                    break;
                }

                // Attribute selector
                case TokenType.OpenSquareBracket: {
                    CssSelectorListParser.handleAttributeSelector(
                        stream,
                        currentComplexSelectorItem.selector,
                        options,
                        baseOffset,
                    );
                    break;
                }

                // Pseudo-class selector
                case TokenType.Colon: {
                    CssSelectorListParser.handlePseudoClassSelector(
                        raw,
                        stream,
                        currentComplexSelectorItem.selector,
                        options,
                        baseOffset,
                    );
                    break;
                }

                // Class selector ('.'), Combinators ('>', '+', '~')
                case TokenType.Delim: {
                    // Get delimiter value
                    const delim = stream.fragment();

                    switch (delim) {
                        // Class selector ('.)
                        case DOT: {
                            CssSelectorListParser.handleClassSelector(
                                stream,
                                currentComplexSelectorItem.selector,
                                options,
                                baseOffset,
                            );
                            break;
                        }

                        // Combinators ('>', '+', '~')
                        case GREATER_THAN:
                        case PLUS:
                        case TILDE: {
                            // Get current complex selector item end token
                            const currentEndToken = stream.lookbehindForNonWs();

                            // Save complex selector item combinator token
                            const combinatorToken = token;

                            // Advance complex selector item combinator token
                            stream.advance();

                            // Skip whitespaces after complex selector item combinator
                            stream.skipWhitespace();

                            // Get next complex selector item start token
                            const nextStartToken = stream.getOrFail();

                            // Finish current complex selector item with combinator
                            finishCurrentComplexSelectorItem(
                                combinatorToken,
                                currentEndToken,
                                nextStartToken,
                                combinatorToken,
                                delim,
                            );

                            break;
                        }

                        default: {
                            throw new AdblockSyntaxError(
                                sprintf(
                                    CssSelectorListParser.UNEXPECTED_TOKEN_WITH_VALUE_ERROR,
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

                // End of current complex selector item (whitespace combinator - descendant)
                case TokenType.Whitespace: {
                    // Get current complex selector item end token
                    const currentEndToken = stream.lookbehindForNonWs();

                    // Save complex selector item combinator token
                    const combinatorToken = token;

                    // Skip whitespaces after complex selector item combinator
                    stream.skipWhitespace();

                    // Get next token (it can be EOF, combinator or comma)
                    const nextStartToken = stream.get();

                    // EOF, combinator or comma - just skip, we shouldn't consider it as descendant combinator
                    if (
                        !nextStartToken
                        || CssSelectorListParser.ALLOWED_SYMBOLS_BETWEEN_SELECTORS.has(stream.fragment())
                    ) {
                        break;
                    }

                    // Finish current complex selector item with whitespace combinator
                    finishCurrentComplexSelectorItem(
                        combinatorToken,
                        currentEndToken,
                        nextStartToken,
                        combinatorToken,
                        SPACE,
                    );

                    break;
                }

                // End of current complex selector
                case TokenType.Comma: {
                    // Get current complex selector end token
                    const currentEndToken = stream.lookbehindForNonWs();

                    // Save complex selector comma token
                    const commaToken = token;

                    // Advance complex selector comma token
                    stream.advance();

                    // Skip whitespaces after complex selector comma token
                    stream.skipWhitespace();

                    // Get next complex selector start token
                    const nextStartToken = stream.getOrFail();

                    // Finish current complex selector
                    finishCurrentComplexSelector(commaToken, currentEndToken, nextStartToken);

                    break;
                }

                default: {
                    throw new AdblockSyntaxError(
                        sprintf(
                            CssSelectorListParser.UNEXPECTED_TOKEN_WITH_VALUE_ERROR,
                            getFormattedTokenName(token.type),
                            stream.fragment(),
                        ),
                        baseOffset + token.start,
                        baseOffset + token.end,
                    );
                }
            }
        }

        // Get last non-whitespace token
        const lastNonWsToken = stream.lookbehindForNonWs();

        // If last non-whitespace token is not found,
        // throw error because it means that there are 0 tokens in the stream
        if (!lastNonWsToken) {
            throw new AdblockSyntaxError(
                sprintf(
                    CssSelectorListParser.UNEXPECTED_TOKEN_WITH_VALUE_ERROR,
                    getFormattedTokenName(TokenType.Eof),
                    raw,
                ),
                baseOffset,
                baseOffset + raw.length,
            );
        }

        // Finish last complex selector
        finishCurrentComplexSelector(lastNonWsToken, lastNonWsToken, lastNonWsToken);

        return result;
    }

    /**
     * Handles tag selector parsing by creating a tag selector node
     * and appending it to the given compound selector node.
     *
     * @param stream Token stream.
     * @param compoundSelector Compound selector node to append the tag selector node to.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @param isAlreadySet Whether the tag selector is already set for the given compound selector.
     *
     * @throws If the tag selector is syntactically incorrect.
     */
    private static handleTagSelector(
        stream: CssTokenStream,
        compoundSelector: CssCompoundSelector,
        options: ParserOptions,
        baseOffset: number,
        isAlreadySet: boolean,
    ): void {
        // Get tag selector token
        const token = stream.getOrFail();

        // Throw error if tag selector is already set
        if (isAlreadySet) {
            throw new AdblockSyntaxError(
                'Tag selector is already set for the compound selector',
                baseOffset + token.start,
                baseOffset + token.end,
            );
        }

        // Throw error if tag selector isn't first in the given compound selector
        if (compoundSelector.children.length > 0) {
            throw new AdblockSyntaxError(
                'Tag selector must be first in the compound selector',
                baseOffset + token.start,
                baseOffset + token.end,
            );
        }

        // Extract tag selector raw value
        const raw = stream.fragment();

        // Construct tag selector node
        const result = ValueParser.parse(
            raw,
            options,
            baseOffset + token.start,
        );

        // Append tag selector node to the given compound selector node
        compoundSelector.children.push(result);

        // Advance tag selector token
        stream.advance();
    }

    /**
     * Handles ID selector parsing by creating an ID selector node
     * and appending it to the given compound selector node.
     *
     * @param stream Token stream.
     * @param compoundSelector Compound selector node to append the ID selector node to.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @throws If the ID selector is syntactically incorrect.
     */
    private static handleIdSelector(
        stream: CssTokenStream,
        compoundSelector: CssCompoundSelector,
        options: ParserOptions,
        baseOffset: number,
    ): void {
        // Get ID selector token
        const token = stream.getOrFail();

        // Extract ID selector raw value (with hashmark)
        const raw = stream.fragment();

        // Construct ID selector node
        const result = ValueParser.parse(
            raw,
            options,
            baseOffset + token.start,
        );

        // Append ID selector node to the given compound selector node
        compoundSelector.children.push(result);

        // Advance ID selector token
        stream.advance();
    }

    /**
     * Handles class selector parsing by creating a class selector node
     * and appending it to the given compound selector node.
     *
     * @param stream Token stream.
     * @param compoundSelector Compound selector node to append the class selector node to.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @throws If the class selector is syntactically incorrect.
     */
    private static handleClassSelector(
        stream: CssTokenStream,
        compoundSelector: CssCompoundSelector,
        options: ParserOptions,
        baseOffset: number,
    ): void {
        // Get class selector dot token
        const token = stream.getOrFail();

        // Advance class selector dot token
        stream.advance();

        // Expect next token to be an identifier (class selector name)
        stream.expect(TokenType.Ident);

        // Extract class selector name raw value (without dot)
        const raw = stream.fragment();

        // Construct class selector node
        const result = ValueParser.parse(
            DOT + raw,
            options,
            baseOffset + token.start,
        );

        // Append class selector node to the given compound selector node
        compoundSelector.children.push(result);

        // Advance class selector name token
        stream.advance();
    }

    /**
     * Handles attribute selector parsing by creating an attribute selector node
     * and appending it to the given compound selector node.
     *
     * @param stream Token stream.
     * @param compoundSelector Compound selector node to append the attribute selector node to.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @throws If the attribute selector is syntactically incorrect.
     */
    private static handleAttributeSelector(
        stream: CssTokenStream,
        compoundSelector: CssCompoundSelector,
        options: ParserOptions,
        baseOffset: number,
    ): void {
        // Get open square bracket token
        let token = stream.getOrFail();

        // Save attribute selector node start position
        const { start } = token;

        // Advance open square bracket token
        stream.advance();

        // Skip whitespaces after open square bracket
        stream.skipWhitespace();

        // Expect next token to be an identifier (attribute selector name)
        stream.expect(TokenType.Ident);

        // Get attribute selector name token
        token = stream.getOrFail();

        // Extract attribute selector name raw value
        const nameRaw = stream.fragment();

        // Construct attribute selector node and attribute selector name node
        const result: CssAttributeSelector = {
            type: 'CssAttributeSelector',
            name: ValueParser.parse(
                nameRaw,
                options,
                baseOffset + token.start,
            ),
        };

        // Include attribute selector node start location if needed
        if (options.isLocIncluded) {
            result.start = baseOffset + start;
        }

        // Advance attribute selector name token
        stream.advance();

        // Skip whitespaces after attribute selector name
        stream.skipWhitespace();

        // Get closing square bracket or equality sign/prefix token
        token = stream.getOrFail();

        // Check if there is an any value
        if (token.type !== TokenType.CloseSquareBracket) {
            // Expect next token to be a delimiter (equality sign/prefix)
            stream.expect(TokenType.Delim);

            // Extract operator raw value
            let operatorRaw = stream.fragment();

            // Check if it's prefix operator
            if (CssSelectorListParser.ATTR_EQUALITY_PREFIXES.has(operatorRaw)) {
                // Advance prefix operator token
                stream.advance();

                // Expect equal sign token
                stream.expect(TokenType.Delim, { value: EQUALS });

                // Append equal sign to prefix value
                operatorRaw += EQUALS;
            } else if (operatorRaw !== EQUALS) {
                // Throw error if it's not equal sign either
                throw new AdblockSyntaxError(
                    sprintf(
                        "Invalid attribute selector operator '%s'",
                        operatorRaw,
                    ),
                    baseOffset + token.start,
                    baseOffset + token.end,
                );
            }

            // Save operator node start position
            const operatorStart = token.start;

            // Advance equal sign token
            stream.advance();

            // Skip whitespaces after equal sign
            stream.skipWhitespace();

            // Get attribute selector value token
            token = stream.getOrFail();

            // It should be a string or identifier
            const isValueString = token.type === TokenType.String;
            if (!isValueString && token.type !== TokenType.Ident) {
                throw new AdblockSyntaxError(
                    sprintf(
                        // eslint-disable-next-line max-len
                        `Expected '${getFormattedTokenName(TokenType.Ident)}' or '${getFormattedTokenName(TokenType.String)}' as attribute selector value, but got '%s' with value '%s'`,
                        getFormattedTokenName(token.type),
                        stream.fragment(),
                    ),
                    baseOffset + token.start,
                    baseOffset + token.end,
                );
            }

            // Save attribute selector value node start position
            const valueStart = token.start + (isValueString ? 1 : 0);

            // Save attribute selector value node end position
            const valueEnd = token.end - (isValueString ? 1 : 0);

            // Extract attribute selector value raw value
            const valueRaw = stream.fragment();

            // We should unescape respective quotes inside of the string value
            const valueUnquotedAndUnescaped = QuoteUtils.removeQuotesAndUnescape(
                valueRaw,
            );

            // Construct attribute selector value node
            result.value = {
                type: 'CssAttributeSelectorValue',
                operator: {
                    type: 'Value',
                    value: operatorRaw as CssAttributeSelectorOperator,
                },
                value: {
                    type: 'Value',
                    value: valueUnquotedAndUnescaped,
                },
            };

            // Include attribute selector value nodes locations if needed
            if (options.isLocIncluded) {
                result.value.operator.start = baseOffset + operatorStart;
                result.value.operator.end = baseOffset + operatorStart + operatorRaw.length;

                result.value.value.start = baseOffset + valueStart;
                result.value.value.end = baseOffset + valueEnd;

                result.value.start = result.value.operator.start;
                result.value.end = result.value.value.end + (isValueString ? 1 : 0);
            }

            // Advance attribute selector value token
            stream.advance();

            // Skip whitespaces after attribute selector value
            stream.skipWhitespace();

            // Get close square bracket or attribute selector value flag token
            token = stream.getOrFail();

            // Check if there is an any flag part
            if (token.type !== TokenType.CloseSquareBracket) {
                // Expect a identifier (attribute selector value flag)
                stream.expect(TokenType.Ident);

                // Extract attribute selector value flag raw value
                const flagRaw = stream.fragment();

                // Validate attribute selector value flag
                if (!CssSelectorListParser.ALLOWED_ATTRIBUTE_FLAGS.has(flagRaw)) {
                    throw new AdblockSyntaxError(
                        sprintf(
                            CssSelectorListParser.UNEXPECTED_TOKEN_WITH_VALUE_ERROR,
                            getFormattedTokenName(token.type),
                            flagRaw,
                        ),
                        baseOffset + token.start,
                        baseOffset + token.end,
                    );
                }

                // Apply attribute selector value flag to attribute selector value node
                result.value.isCaseSensitive = flagRaw === CssSelectorListParser.CASE_SENSITIVE_FLAG;

                // Update attribute selector value node end location if needed
                if (options.isLocIncluded) {
                    result.value.end = baseOffset + token.end;
                }

                // Advance attribute selector value flag token
                stream.advance();

                // Skip whitespaces after attribute selector value flag
                stream.skipWhitespace();

                // Get close square bracket token
                token = stream.getOrFail();
            }
        }

        // Expect close square bracket token
        stream.expect(TokenType.CloseSquareBracket);

        // Include attribute selector node end location if needed
        if (options.isLocIncluded) {
            result.end = baseOffset + token.end;
        }

        // Append attribute selector node to compound selector node
        compoundSelector.children.push(result);

        // Advance close square bracket token
        stream.advance();
    }

    /**
     * Handles pseudo-class selector parsing by creating an pseudo-class selector node
     * and appending it to the given compound selector node.
     *
     * @param raw Raw input to parse.
     * @param stream Token stream.
     * @param compoundSelector Compound selector node to append the pseudo-class selector node to.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @throws If the pseudo-class selector is syntactically incorrect.
     */
    private static handlePseudoClassSelector(
        raw: string,
        stream: CssTokenStream,
        compoundSelector: CssCompoundSelector,
        options: ParserOptions,
        baseOffset: number,
    ): void {
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
        const result: CssPseudoClassSelector = {
            type: 'CssPseudoClassSelector',
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
                // Save pseudo-class selector argument start position
                const argumentStart = token.start;

                // Skip until closing parenthesis
                stream.skipUntilBalanced();

                // Get closing parenthesis token
                token = stream.getOrFail();

                // Save pseudo-class selector argument end position (ends before closing parenthesis)
                const argumentEnd = token.start;

                // Extract pseudo-class selector argument raw value
                const argumentRaw = raw.slice(argumentStart, argumentEnd).trimEnd();

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

        // Append pseudo-class selector node to compound selector node
        compoundSelector.children.push(result);

        // Advance pseudo-class selector name token (if ident) or closing parenthesis token (if function)
        stream.advance();
    }
}
