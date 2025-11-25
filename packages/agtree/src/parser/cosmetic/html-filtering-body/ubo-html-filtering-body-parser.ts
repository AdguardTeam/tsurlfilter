import { getFormattedTokenName, TokenType } from '@adguard/css-tokenizer';
import { sprintf } from 'sprintf-js';

import {
    type HtmlFilteringRuleSelector,
    type HtmlFilteringRuleBody,
    type HtmlFilteringRuleSelectorAttribute,
    type HtmlFilteringRuleSelectorPseudoClass,
} from '../../../nodes';
import { BaseParser } from '../../base-parser';
import { CssTokenStream } from '../../css/css-token-stream';
import { defaultParserOptions } from '../../options';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { ValueParser } from '../../misc/value-parser';
import {
    DOUBLE_QUOTE,
    EQUALS,
    UBO_HTML_MASK,
    UBO_RESPONSEHEADER_FN,
} from '../../../utils/constants';
import { QuoteUtils } from '../../../utils/quotes';
import { StringUtils } from '../../../utils/string';

/**
 * `UboHtmlFilteringBodyParser` is responsible for parsing the body of an uBlock-style HTML filtering rule,
 * and also uBlock-style response header removal rule.
 *
 * Please note that the parser will parse any HTML filtering rule if it is syntactically correct.
 * For example, it will parse this:
 * ```adblock
 * example.com##^script:pseudo(content)
 * example.com##^responseheader(header-name)
 * ```
 *
 * but it didn't check if the pseudo selector `pseudo` or if the header name `header-name`
 * actually supported by any adblocker.
 *
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#html-filters}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#response-header-filtering}
 */
export class UboHtmlFilteringBodyParser extends BaseParser {
    /**
     * Error messages used in the parser.
     */
    private static readonly ERROR_MESSAGES = {
        UNEXPECTED_TOKEN_WITH_VALUE: "Unexpected token '%s' with value '%s'",
        INVALID_ATTRIBUTE_NAME: "Attribute name should be an identifier, but got '%s' with value '%s'",
        // eslint-disable-next-line max-len
        INVALID_ATTRIBUTE_VALUE: `Expected '${getFormattedTokenName(TokenType.Ident)}' or '${getFormattedTokenName(TokenType.String)}' as attribute value, but got '%s' with value '%s'`,
        TAG_SHOULD_BE_FIRST_CHILD: "Unexpected token '%s' with value '%s', tag selector should be the first child",
        // eslint-disable-next-line max-len
        ATTRIBUTES_SHOULD_BE_BEFORE_PSEUDO_CLASSES: "Unexpected token '%s' with value '%s', attributes should be defined before pseudo classes",
        EMPTY_BEFORE_PSEUDO_CLASS: 'Pseudo class cannot be the first child of a selector',
        EMPTY_BODY: 'HTML filtering rule body cannot be empty',
        UNEXPECTED_EMPTY_SELECTOR: 'Unexpected empty selector',
        EMPTY_RESPONSEHEADER_PARAMETER: `Empty parameter for '${UBO_RESPONSEHEADER_FN}' function`,
        EXPECTED_END_OF_RULE: "Expected end of rule, but got '%s'",
    };

    /**
     * Parses the body of an uBlock-style HTML filtering rule
     * and also uBlock-style response header removal rule.
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
     * ^div:has-text(Example)
     * ^responseheader(header-name)
     * ```
     */
    public static parse(
        raw: string,
        options = defaultParserOptions,
        baseOffset = 0,
    ): HtmlFilteringRuleBody {
        // First, check if it's a response header removal rule and return if so
        const responseHeaderBody = UboHtmlFilteringBodyParser.parseResponseHeaderRule(
            raw,
            options,
            baseOffset,
        );
        if (responseHeaderBody !== null) {
            return responseHeaderBody;
        }

        // Construct the body node
        const result: HtmlFilteringRuleBody = {
            type: 'HtmlFilteringRuleBody',
            selectors: [],
        };

        // Include location info if needed
        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        const stream = new CssTokenStream(raw, baseOffset);

        // Skip leading whitespace
        stream.skipWhitespace();

        // Skip ^
        stream.expect(TokenType.Delim, { value: UBO_HTML_MASK });
        stream.advance();

        // Skip leading whitespace
        stream.skipWhitespace();

        // Construct the first selector node
        let currentSelector: HtmlFilteringRuleSelector = {
            type: 'HtmlFilteringRuleSelector',
            attributes: [],
            pseudoClasses: [],
        };

        // Specify start selector location if needed
        if (options.isLocIncluded) {
            const token = stream.getOrFail();
            currentSelector.start = token.start + baseOffset;
        }

        while (!stream.isEof()) {
            let token = stream.getOrFail();

            if (token.type === TokenType.Whitespace) {
                // Skip whitespace
                stream.advance();
            } else if (token.type === TokenType.Comma && token.balance === 0) {
                // Selector separator

                // Throw error if no tag name or attributes were defined
                if (currentSelector.tagName === undefined && currentSelector.attributes.length === 0) {
                    if (currentSelector.pseudoClasses.length > 0) {
                        throw new AdblockSyntaxError(
                            UboHtmlFilteringBodyParser.ERROR_MESSAGES.EMPTY_BEFORE_PSEUDO_CLASS,
                            token.start + baseOffset,
                            token.end + baseOffset,
                        );
                    }

                    throw new AdblockSyntaxError(
                        UboHtmlFilteringBodyParser.ERROR_MESSAGES.EMPTY_BODY,
                        baseOffset,
                        baseOffset + raw.length,
                    );
                }

                // Specify end selector location if needed
                if (options.isLocIncluded) {
                    const lastNonWsSelectorToken = stream.lookbehindForNonWs();

                    if (!lastNonWsSelectorToken) {
                        throw new AdblockSyntaxError(
                            UboHtmlFilteringBodyParser.ERROR_MESSAGES.UNEXPECTED_EMPTY_SELECTOR,
                            token.start + baseOffset,
                            token.end + baseOffset,
                        );
                    }

                    currentSelector.end = lastNonWsSelectorToken.end + baseOffset;
                }

                // Add current selector to the body
                result.selectors.push(currentSelector);

                // Create a new selector
                currentSelector = {
                    type: 'HtmlFilteringRuleSelector',
                    attributes: [],
                    pseudoClasses: [],
                };

                // Consume the comma token
                stream.advance();

                // Skip optional whitespace
                stream.skipWhitespace();

                // Specify start selector location if needed
                if (options.isLocIncluded) {
                    token = stream.getOrFail();
                    currentSelector.start = token.start + baseOffset;
                }
            } else if (token.type === TokenType.Ident) {
                // Tag name

                // Throw error if tag name is already defined
                // It can happen in cases like: `div[attr="value"]span`, `div span[attr="value"]`
                if (currentSelector.tagName !== undefined) {
                    throw new AdblockSyntaxError(
                        sprintf(
                            UboHtmlFilteringBodyParser.ERROR_MESSAGES.UNEXPECTED_TOKEN_WITH_VALUE,
                            getFormattedTokenName(token.type),
                            stream.fragment(),
                        ),
                        token.start + baseOffset,
                        token.end + baseOffset,
                    );
                }

                // Throw error if there are already attributes or pseudo classes defined
                // It can happen in cases like: `[attr="value"]div`, `[attr="value"]:pseudo() div`
                if (currentSelector.attributes.length > 0 || currentSelector.pseudoClasses.length > 0) {
                    throw new AdblockSyntaxError(
                        sprintf(
                            UboHtmlFilteringBodyParser.ERROR_MESSAGES.TAG_SHOULD_BE_FIRST_CHILD,
                            getFormattedTokenName(token.type),
                            stream.fragment(),
                        ),
                        token.start + baseOffset,
                        token.end + baseOffset,
                    );
                }

                // Construct the tag name node
                currentSelector.tagName = ValueParser.parse(
                    stream.fragment(),
                    options,
                    token.start + baseOffset,
                );

                // Advance the stream
                stream.advance();
            } else if (token.type === TokenType.OpenSquareBracket) {
                // Attribute

                // Throw error if there are already pseudo classes defined
                // It can happen in cases like: `div:pseudo()[attr="value"]`
                if (currentSelector.pseudoClasses.length !== 0) {
                    throw new AdblockSyntaxError(
                        sprintf(
                            UboHtmlFilteringBodyParser.ERROR_MESSAGES.ATTRIBUTES_SHOULD_BE_BEFORE_PSEUDO_CLASSES,
                            getFormattedTokenName(token.type),
                            stream.fragment(),
                        ),
                        token.start + baseOffset,
                        token.end + baseOffset,
                    );
                }

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
                            UboHtmlFilteringBodyParser.ERROR_MESSAGES.INVALID_ATTRIBUTE_NAME,
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
                currentSelector.attributes.push(attribute);

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
                                UboHtmlFilteringBodyParser.ERROR_MESSAGES.INVALID_ATTRIBUTE_VALUE,
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

                    // Get next token (can be flags)
                    const possibleFlagToken = stream.get();
                    if (possibleFlagToken && possibleFlagToken.type === TokenType.Ident) {
                        // Construct the attribute flags node
                        attribute.flags = ValueParser.parse(
                            stream.fragment(),
                            options,
                            possibleFlagToken.start + baseOffset,
                        );

                        // Advance the stream
                        stream.advance();

                        // Skip optional whitespace
                        stream.skipWhitespace();
                    }
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
            } else if (token.type === TokenType.Colon) {
                // Pseudo class

                // Throw error if there are no previous selector children
                // It can happen in cases like: `:pseudo()`
                if (
                    currentSelector.tagName === undefined
                    && currentSelector.attributes.length === 0
                ) {
                    throw new AdblockSyntaxError(
                        UboHtmlFilteringBodyParser.ERROR_MESSAGES.EMPTY_BEFORE_PSEUDO_CLASS,
                        token.start + baseOffset,
                        token.end + baseOffset,
                    );
                }

                // Save the pseudo class start offset (starts with colon)
                const pseudoClassStartOffset = token.start;

                // Consume colon
                stream.advance();

                // Next token should be a pseudo class name
                stream.expect(TokenType.Function);

                // Get next token (pseudo class name), e.g. `has-text(`
                token = stream.getOrFail();

                // Get the pseudo class name without the opening parenthesis
                const pseudoClassNameRaw = raw.slice(token.start, token.end - 1);

                // Construct the pseudo class node
                const pseudoClassName = ValueParser.parse(
                    pseudoClassNameRaw,
                    options,
                    token.start + baseOffset,
                );

                // Advance the function token
                stream.advance();

                // Skip optional whitespace
                stream.skipWhitespace();
                token = stream.getOrFail();

                // Save the pseudo class content start offset (starts after opening parenthesis)
                const pseudoClassContentStartOffset = token.start;

                // Find the closing parenthesis
                stream.skipUntilBalanced();
                token = stream.getOrFail();

                // Save the pseudo class content end offset (ends before closing parenthesis)
                const pseudoClassContentEndOffset = token.end - 1;

                // Extract the pseudo class content
                const pseudoClassContentValue = raw.slice(
                    pseudoClassContentStartOffset,
                    pseudoClassContentEndOffset,
                ).trimEnd();

                // Get the pseudo class content and escape double quotes
                const pseudoClassContentEscaped = StringUtils.escapeCharacter(pseudoClassContentValue, DOUBLE_QUOTE);

                // Construct the pseudo class content node
                const pseudoClassContent = ValueParser.parse(
                    pseudoClassContentEscaped,
                    options,
                    pseudoClassContentStartOffset + baseOffset,
                );

                // Advance the stream
                stream.advance();

                // Construct the pseudo class node
                const pseudoClass: HtmlFilteringRuleSelectorPseudoClass = {
                    type: 'HtmlFilteringRuleSelectorPseudoClass',
                    name: pseudoClassName,
                    content: pseudoClassContent,
                };

                // Specify pseudo class location if needed
                if (options.isLocIncluded) {
                    pseudoClass.start = pseudoClassStartOffset + baseOffset;
                    pseudoClass.end = token.end + baseOffset;
                }

                // Add pseudo class name
                currentSelector.pseudoClasses.push(pseudoClass);
            } else {
                // Throw error for unexpected tokens
                throw new AdblockSyntaxError(
                    sprintf(
                        UboHtmlFilteringBodyParser.ERROR_MESSAGES.UNEXPECTED_TOKEN_WITH_VALUE,
                        getFormattedTokenName(token.type),
                        stream.fragment(),
                    ),
                    token.start + baseOffset,
                    token.end + baseOffset,
                );
            }
        }

        // Throw error if no tag name or attributes were defined
        if (currentSelector.tagName === undefined && currentSelector.attributes.length === 0) {
            if (currentSelector.pseudoClasses.length > 0) {
                throw new AdblockSyntaxError(
                    UboHtmlFilteringBodyParser.ERROR_MESSAGES.EMPTY_BEFORE_PSEUDO_CLASS,
                    baseOffset,
                    baseOffset + raw.length,
                );
            }

            throw new AdblockSyntaxError(
                UboHtmlFilteringBodyParser.ERROR_MESSAGES.EMPTY_BODY,
                baseOffset,
                baseOffset + raw.length,
            );
        }

        // Specify end selector location if needed
        if (options.isLocIncluded) {
            const lastNonWsSelectorToken = stream.lookbehindForNonWs();

            if (!lastNonWsSelectorToken) {
                throw new AdblockSyntaxError(
                    UboHtmlFilteringBodyParser.ERROR_MESSAGES.UNEXPECTED_EMPTY_SELECTOR,
                    baseOffset + raw.length - 1,
                    baseOffset + raw.length,
                );
            }

            currentSelector.end = lastNonWsSelectorToken.end + baseOffset;
        }

        // Add the last selector to the body
        result.selectors.push(currentSelector);

        return result;
    }

    /**
     * Parses uBlock-style response header removal rule body.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @returns Node of the parsed response header removal rule body
     * or `null` if the body is not a response header removal rule.
     *
     * @throws If the body is syntactically incorrect.
     *
     * @example
     * ```
     * ^responseheader(header-name)
     * ```
     *
     * @note This method returns `HtmlFilteringRuleBody` because,
     * response header removal rule syntax is same as uBlock-style
     * HTML filtering rule syntax.
     */
    private static parseResponseHeaderRule(
        raw: string,
        options = defaultParserOptions,
        baseOffset = 0,
    ): HtmlFilteringRuleBody | null {
        const stream = new CssTokenStream(raw, baseOffset);

        // Skip leading whitespace
        stream.skipWhitespace();

        // Traverse stream with this token
        let token = stream.get();

        // Next token should be the `^`
        if (!token || token.type !== TokenType.Delim || raw[token.start] !== UBO_HTML_MASK) {
            return null;
        }

        // Skip `^`
        stream.advance();

        // Get next token
        token = stream.get();

        // Next token should be a function
        if (!token || token.type !== TokenType.Function) {
            return null;
        }

        // Save the selector start offset
        const selectorStartOffset = token.start;

        // Get the function name without the opening parenthesis
        const functionName = raw.slice(token.start, token.end - 1);

        // Check if it's `responseheader` function
        if (functionName !== UBO_RESPONSEHEADER_FN) {
            return null;
        }

        // Skip the function
        stream.advance();

        // Construct the pseudo class name node
        const pseudoClassName = ValueParser.parse(
            functionName,
            options,
            token.start + baseOffset,
        );

        // Skip whitespace after function name
        stream.skipWhitespace();
        token = stream.getOrFail();

        // Save the parameter start offset (starts after opening parenthesis)
        const paramStart = token.start;

        // Skip until balanced closing parenthesis
        stream.skipUntilBalanced();

        // Save the parameter end offset (ends before closing parenthesis)
        const paramEnd = stream.getOrFail().end - 1;

        // Extract the parameter
        const param = raw.slice(paramStart, paramEnd).trimEnd();

        // Do not allow empty parameter
        if (param.length === 0) {
            throw new AdblockSyntaxError(
                UboHtmlFilteringBodyParser.ERROR_MESSAGES.EMPTY_RESPONSEHEADER_PARAMETER,
                paramStart + baseOffset,
                paramEnd + baseOffset,
            );
        }

        // Construct the pseudo class content node
        const pseudoClassContent = ValueParser.parse(
            param,
            options,
            paramStart + baseOffset,
        );

        // Skip closing parenthesis
        stream.expect(TokenType.CloseParenthesis);
        stream.advance();

        // Skip trailing whitespace after the function call
        stream.skipWhitespace();

        // Expect the end of the rule - so nothing should be left in the stream
        if (!stream.isEof()) {
            token = stream.getOrFail();
            throw new AdblockSyntaxError(
                sprintf(
                    UboHtmlFilteringBodyParser.ERROR_MESSAGES.EXPECTED_END_OF_RULE,
                    getFormattedTokenName(token.type),
                ),
                token.start + baseOffset,
                token.end + baseOffset,
            );
        }

        // Construct the pseudo class node
        const pseudoClass: HtmlFilteringRuleSelectorPseudoClass = {
            type: 'HtmlFilteringRuleSelectorPseudoClass',
            name: pseudoClassName,
            content: pseudoClassContent,
        };

        // Construct the selector node
        const selector: HtmlFilteringRuleSelector = {
            type: 'HtmlFilteringRuleSelector',
            attributes: [],
            pseudoClasses: [pseudoClass],
        };

        // Construct the body node
        const result: HtmlFilteringRuleBody = {
            type: 'HtmlFilteringRuleBody',
            selectors: [selector],
        };

        // Include location info if needed
        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = raw.length + baseOffset;

            selector.start = selectorStartOffset + baseOffset;
            selector.end = raw.length + baseOffset;

            pseudoClass.start = selector.start;
            pseudoClass.end = selector.end;
        }

        return result;
    }
}
