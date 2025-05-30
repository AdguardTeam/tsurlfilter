/**
 * @file HTML filtering rule converter
 */

import { TokenType, getFormattedTokenName } from '@adguard/css-tokenizer';
import { sprintf } from 'sprintf-js';

import {
    CosmeticRuleSeparator,
    CosmeticRuleType,
    type HtmlFilteringRule,
    RuleCategory,
} from '../../nodes';
import { AdblockSyntax } from '../../utils/adblockers';
import { RuleConversionError } from '../../errors/rule-conversion-error';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { RegExpUtils } from '../../utils/regexp';
import { type NodeConversionResult, createNodeConversionResult } from '../base-interfaces/conversion-result';
import { cloneDomainListNode } from '../../ast-utils/clone';
import { CssTokenStream } from '../../parser/css/css-token-stream';
import {
    CLOSE_SQUARE_BRACKET,
    CSS_PSEUDO_CLOSE,
    CSS_PSEUDO_MARKER,
    CSS_PSEUDO_OPEN,
    EMPTY,
    EQUALS,
    ESCAPE_CHARACTER,
    OPEN_SQUARE_BRACKET,
    SPACE,
    UBO_HTML_MASK,
} from '../../utils/constants';
import { DOUBLE_QUOTE_MARKER, StringUtils } from '../../utils/string';
import { QuoteUtils } from '../../utils';

/**
 * From the AdGuard docs:
 * Specifies the maximum length for content of HTML element. If this parameter is
 * set and the content length exceeds the value, a rule does not apply to the element.
 * If this parameter is not specified, the max-length is considered to be 8192 (8 KB).
 * When converting from other formats, we set the max-length to 262144 (256 KB).
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#html-filtering-rules}
 */
const ADG_HTML_DEFAULT_MAX_LENGTH = 8192;
const ADG_HTML_CONVERSION_MAX_LENGTH = ADG_HTML_DEFAULT_MAX_LENGTH * 32;

const NOT_SPECIFIED = -1;

const PseudoClasses = {
    Contains: 'contains',
    HasText: 'has-text',
    MinTextLength: 'min-text-length',
} as const;

/**
 * Constructs a pseudo-class string with a specified value for use in CSS selectors.
 *
 * @param pseudo - The pseudo-class name.
 * @param value - The value of the pseudo-class.
 * @returns pseudo-class string, including pseudo-class name, value and delimiters.
 */
const addPseudoClassWithValue = <K extends keyof typeof PseudoClasses>(
    pseudo: typeof PseudoClasses[K],
    value: string | number,
): string => {
    return `${CSS_PSEUDO_MARKER}${pseudo}${CSS_PSEUDO_OPEN}${value}${CSS_PSEUDO_CLOSE}`;
};

const AttributeSelectors = {
    MaxLength: 'max-length',
    MinLength: 'min-length',
    TagContent: 'tag-content',
    Wildcard: 'wildcard',
} as const;

const SUPPORTED_UBO_PSEUDO_CLASSES = new Set<string>([
    PseudoClasses.Contains,
    PseudoClasses.HasText,
    PseudoClasses.MinTextLength,
]);

export const ERROR_MESSAGES = {
    ABP_NOT_SUPPORTED: 'Invalid rule, ABP does not support HTML filtering rules',
    TAG_SHOULD_BE_FIRST_CHILD: "Unexpected token '%s' with value '%s', tag selector should be the first child",
    EXPECTED_BUT_GOT_WITH_VALUE: "Expected '%s', but got '%s' with value '%s'",
    INVALID_ATTRIBUTE_NAME: "Attribute name should be an identifier, but got '%s' with value '%s'",
    // eslint-disable-next-line max-len
    INVALID_ATTRIBUTE_VALUE: `Expected '${getFormattedTokenName(TokenType.Ident)}' or '${getFormattedTokenName(TokenType.String)}' as attribute value, but got '%s' with value '%s`,
    INVALID_FLAG: "Unsupported attribute selector flag '%s'",
    INVALID_OPERATOR_FOR_ATTR: "Unsupported operator '%s' for '%s' attribute",
    VALUE_FOR_ATTR_SHOULD_BE_INT: "Value for '%s' attribute should be an integer, but got '%s'",
    INVALID_PSEUDO_CLASS: "Unsupported pseudo class '%s'",
    VALUE_FOR_PSEUDO_CLASS_SHOULD_BE_INT: "Value for '%s' pseudo class should be an integer, but got '%s'",
    // eslint-disable-next-line max-len
    REGEXP_NOT_SUPPORTED: "Cannot convert RegExp parameter '%s' from '%s' pseudo class, because converting RegExp patterns are not supported yet",
    ATTRIBUTE_SELECTOR_REQUIRES_VALUE: "Attribute selector '%s' requires a value",
    INVALID_ATTRIBUTE_SELECTOR_OPERATOR: "Unsupported attribute selector operator '%s'",
    VALUE_SHOULD_BE_SPECIFIED: 'Value should be specified if operator is specified',
    VALUE_SHOULD_BE_POSITIVE: 'Value should be positive',
    OPERATOR_SHOULD_BE_SPECIFIED: 'Operator should be specified if value is specified',
    UNEXPECTED_TOKEN_WITH_VALUE: "Unexpected token '%s' with value '%s'",
    FLAGS_NOT_SUPPORTED: 'Flags are not supported for attribute selectors',
};

/**
 * Convert `""` to `\"` within strings, because it does not compatible with the standard CSS syntax.
 *
 * @param selector CSS selector string
 * @returns Escaped CSS selector
 * @note In the legacy syntax, `""` is used to escape double quotes, but it cannot be used in the standard CSS syntax,
 * so we use conversion functions to handle this.
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#tag-content}
 */
function escapeDoubleQuotes(selector: string): string {
    let withinString = false;
    const buffer: string[] = [];

    for (let i = 0; i < selector.length; i += 1) {
        if (!withinString && selector[i] === DOUBLE_QUOTE_MARKER) {
            withinString = true;
            buffer.push(selector[i]);
        } else if (withinString && selector[i] === DOUBLE_QUOTE_MARKER && selector[i + 1] === DOUBLE_QUOTE_MARKER) {
            buffer.push(ESCAPE_CHARACTER);
            buffer.push(DOUBLE_QUOTE_MARKER);
            i += 1;
        } else if (withinString && selector[i] === DOUBLE_QUOTE_MARKER && selector[i + 1] !== DOUBLE_QUOTE_MARKER) {
            buffer.push(DOUBLE_QUOTE_MARKER);
            withinString = false;
        } else {
            buffer.push(selector[i]);
        }
    }

    return buffer.join(EMPTY);
}

/**
 * Safely parses length values from attribute selectors, like `"262144"` from `[max-length="262144"]`
 *
 * @param value The string value to parse
 * @param attrName The attribute name for error messages
 * @returns Parsed number
 * @throws A {@link RuleConversionError} if parsing fails
 */
function parseLengthValue(value: string, attrName: string): number {
    const cleanValue = QuoteUtils.removeQuotes(value);

    const parsed = Number(cleanValue);

    if (Number.isNaN(parsed)) {
        throw new RuleConversionError(
            sprintf(ERROR_MESSAGES.VALUE_FOR_ATTR_SHOULD_BE_INT, attrName, value),
        );
    }

    if (parsed < 0) {
        throw new RuleConversionError(
            sprintf(ERROR_MESSAGES.VALUE_SHOULD_BE_POSITIVE, attrName, value),
        );
    }

    return parsed;
}

/**
 * Convert escaped double quotes `\"` to `""` within strings.
 *
 * @param selector CSS selector string
 * @returns Unescaped CSS selector
 * @note In the legacy syntax, `""` is used to escape double quotes, but it cannot be used in the standard CSS syntax,
 * so we use conversion functions to handle this.
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#tag-content}
 */
function unescapeDoubleQuotes(selector: string): string {
    let withinString = false;
    const buffer: string[] = [];

    for (let i = 0; i < selector.length; i += 1) {
        if (selector[i] === DOUBLE_QUOTE_MARKER && selector[i - 1] !== ESCAPE_CHARACTER) {
            withinString = !withinString;
            buffer.push(selector[i]);
        } else if (withinString && selector[i] === ESCAPE_CHARACTER && selector[i + 1] === DOUBLE_QUOTE_MARKER) {
            buffer.push(DOUBLE_QUOTE_MARKER);
        } else {
            buffer.push(selector[i]);
        }
    }

    return buffer.join(EMPTY);
}

/**
 * Helper function to render an attribute selector
 *
 * @param attr Attribute name
 * @param op Operator (optional)
 * @param value Attribute value (optional)
 * @param flags Attribute flags (optional)
 * @returns Rendered attribute selector string
 */
function renderAttrSelector(attr: string, op?: string, value?: string, flags?: string): string {
    const result: string[] = [];

    result.push(OPEN_SQUARE_BRACKET);
    result.push(attr);

    if (op !== undefined) {
        if (value === undefined) {
            throw new Error(ERROR_MESSAGES.VALUE_SHOULD_BE_SPECIFIED);
        }

        result.push(op);
    }

    if (value !== undefined) {
        if (!op) {
            throw new Error(ERROR_MESSAGES.OPERATOR_SHOULD_BE_SPECIFIED);
        }

        result.push(DOUBLE_QUOTE_MARKER);
        result.push(value);
        result.push(DOUBLE_QUOTE_MARKER);
    }

    if (flags !== undefined) {
        result.push(SPACE);
        result.push(flags);
    }

    result.push(CLOSE_SQUARE_BRACKET);

    return result.join(EMPTY);
}

/**
 * HTML filtering rule converter class
 *
 * @todo Implement `convertToUbo` (ABP currently doesn't support HTML filtering rules)
 */
export class HtmlRuleConverter extends RuleConverterBase {
    /**
     * Converts a HTML rule to AdGuard syntax, if possible. Also can be used to convert
     * AdGuard rules to AdGuard syntax to validate them.
     *
     * _Note:_ uBlock Origin supports multiple selectors within a single rule, but AdGuard doesn't,
     * so the following rule
     * ```
     * example.com##^div[attr1="value1"][attr2="value2"], script:has-text(value)
     * ```
     * will be converted to multiple AdGuard rules:
     * ```
     * example.com$$div[attr1="value1"][attr2="value2"][max-length="262144"]
     * example.com$$script[tag-content="value"][max-length="262144"]
     * ```
     *
     * @param rule Rule node to convert
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: HtmlFilteringRule): NodeConversionResult<HtmlFilteringRule> {
        // Ignore AdGuard rules
        if (rule.syntax === AdblockSyntax.Adg) {
            return createNodeConversionResult([rule], false);
        }

        if (rule.syntax === AdblockSyntax.Abp) {
            throw new RuleConversionError(ERROR_MESSAGES.ABP_NOT_SUPPORTED);
        }

        const source = escapeDoubleQuotes(rule.body.value);
        const stream = new CssTokenStream(source);

        const convertedSelector: string[] = [];
        const convertedSelectorList: string[] = [];

        let minLen = NOT_SPECIFIED;
        let maxLen = NOT_SPECIFIED;

        // Skip leading whitespace
        stream.skipWhitespace();

        // Skip ^
        stream.expect(TokenType.Delim, { value: UBO_HTML_MASK });
        stream.advance();

        while (!stream.isEof()) {
            const token = stream.getOrFail();

            if (token.type === TokenType.Ident) {
                // Tag selector should be the first child, if present, but whitespace is allowed before it
                if (convertedSelector.length !== 0 && stream.lookbehindForNonWs() !== undefined) {
                    throw new RuleConversionError(
                        sprintf(
                            ERROR_MESSAGES.TAG_SHOULD_BE_FIRST_CHILD,
                            getFormattedTokenName(token.type),
                            source.slice(token.start, token.end),
                        ),
                    );
                }

                convertedSelector.push(source.slice(token.start, token.end));
                stream.advance();
            } else if (token.type === TokenType.OpenSquareBracket) {
                // Attribute selectors: https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax
                const { start } = token;
                let tempToken;

                // Advance opening square bracket
                stream.advance();

                // Skip optional whitespace after the opening square bracket
                stream.skipWhitespace();

                // Parse attribute name
                tempToken = stream.getOrFail();

                if (tempToken.type !== TokenType.Ident) {
                    throw new RuleConversionError(
                        sprintf(
                            ERROR_MESSAGES.INVALID_ATTRIBUTE_NAME,
                            getFormattedTokenName(tempToken.type),
                            source.slice(tempToken.start, tempToken.end),
                        ),
                    );
                }

                const attr = source.slice(tempToken.start, tempToken.end);
                stream.advance();

                // Skip optional whitespace after the attribute name
                stream.skipWhitespace();

                // Maybe attribute selector ends here, because value is not required, like in '[disabled]'
                tempToken = stream.getOrFail();

                // So check if the next non whitespace token is a closing square bracket
                if (tempToken.type === TokenType.CloseSquareBracket) {
                    const { end } = tempToken;
                    stream.advance();

                    // Special case for min-length and max-length attributes
                    if (attr === AttributeSelectors.MinLength || attr === AttributeSelectors.MaxLength) {
                        throw new RuleConversionError(sprintf(ERROR_MESSAGES.ATTRIBUTE_SELECTOR_REQUIRES_VALUE, attr));
                    }

                    convertedSelector.push(source.slice(start, end));
                    continue;
                }

                // Next token should be a valid attribute selector operator
                // Only '=' operator is supported
                stream.expect(TokenType.Delim, { value: EQUALS });

                // Advance the operator
                stream.advance();

                // Skip optional whitespace after the operator
                stream.skipWhitespace();

                // Parse attribute value
                tempToken = stream.getOrFail();

                // According to the spec, attribute value should be an identifier or a string
                if (tempToken.type !== TokenType.Ident && tempToken.type !== TokenType.String) {
                    throw new RuleConversionError(
                        sprintf(
                            ERROR_MESSAGES.INVALID_ATTRIBUTE_VALUE,
                            getFormattedTokenName(tempToken.type),
                            source.slice(tempToken.start, tempToken.end),
                        ),
                    );
                }

                const value = source.slice(tempToken.start, tempToken.end);

                // Advance the attribute value
                stream.advance();

                // Skip optional whitespace after the attribute value
                stream.skipWhitespace();

                // Attribute selector may have flags - but AdGuard HTML filtering does not support them
                tempToken = stream.getOrFail();

                if (tempToken.type === TokenType.Ident) {
                    throw new RuleConversionError(sprintf(ERROR_MESSAGES.FLAGS_NOT_SUPPORTED));
                }

                // Next token should be a closing square bracket
                stream.expect(TokenType.CloseSquareBracket);
                const { end } = stream.getOrFail();
                stream.advance();

                if (attr === AttributeSelectors.MinLength) {
                    // Min length attribute
                    const parsed = parseInt(value, 10);

                    if (Number.isNaN(parsed)) {
                        throw new RuleConversionError(
                            sprintf(ERROR_MESSAGES.VALUE_FOR_ATTR_SHOULD_BE_INT, attr, value),
                        );
                    }

                    minLen = parsed;
                } else if (attr === AttributeSelectors.MaxLength) {
                    // Max length attribute
                    const parsed = parseInt(value, 10);

                    if (Number.isNaN(parsed)) {
                        throw new RuleConversionError(
                            sprintf(ERROR_MESSAGES.VALUE_FOR_ATTR_SHOULD_BE_INT, attr, value),
                        );
                    }

                    maxLen = parsed;
                } else {
                    convertedSelector.push(source.slice(start, end));
                }
            } else if (token.type === TokenType.Colon) {
                let tempToken;

                // Pseudo classes: https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-classes#syntax
                stream.advance();

                // Next token should be a pseudo class name
                stream.expect(TokenType.Function);
                tempToken = stream.getOrFail();
                const fn = source.slice(tempToken.start, tempToken.end - 1); // do not include '('

                // Pseudo class should be supported
                if (!SUPPORTED_UBO_PSEUDO_CLASSES.has(fn)) {
                    throw new RuleConversionError(sprintf(ERROR_MESSAGES.INVALID_PSEUDO_CLASS, fn));
                }

                const paramStart = tempToken.end;

                // Find the closing paren
                stream.skipUntilBalanced();

                tempToken = stream.getOrFail();
                const paramEnd = tempToken.end;

                // Get the parameter
                const param = source.slice(paramStart, paramEnd - 1);

                if (fn === PseudoClasses.MinTextLength) {
                    // Min text length pseudo class
                    // Parameter should be parsed as an integer
                    const parsed = parseInt(param, 10);

                    if (Number.isNaN(parsed)) {
                        throw new RuleConversionError(
                            sprintf(ERROR_MESSAGES.VALUE_FOR_PSEUDO_CLASS_SHOULD_BE_INT, fn, param),
                        );
                    }

                    minLen = parsed;
                } else if (fn === PseudoClasses.Contains || fn === PseudoClasses.HasText) {
                    // Contains and has-text pseudo classes
                    // Check if the argument is a RegExp
                    if (RegExpUtils.isRegexPattern(param)) {
                        // TODO: Add some support for RegExp patterns later
                        // Need to find a way to convert some RegExp patterns to glob patterns
                        throw new RuleConversionError(sprintf(ERROR_MESSAGES.REGEXP_NOT_SUPPORTED, param, fn));
                    }

                    // Escape unescaped double quotes in the parameter
                    const paramEscaped = StringUtils.escapeCharacter(param, DOUBLE_QUOTE_MARKER);
                    convertedSelector.push(renderAttrSelector(AttributeSelectors.TagContent, EQUALS, paramEscaped));
                }

                stream.advance();
            } else if (token.type === TokenType.Comma && token.balance === 0) {
                if (minLen !== NOT_SPECIFIED) {
                    convertedSelector.push(renderAttrSelector(AttributeSelectors.MinLength, EQUALS, minLen.toString()));
                }
                convertedSelector.push(
                    renderAttrSelector(
                        AttributeSelectors.MaxLength,
                        EQUALS,
                        maxLen !== NOT_SPECIFIED ? maxLen.toString() : ADG_HTML_CONVERSION_MAX_LENGTH.toString(),
                    ),
                );
                convertedSelectorList.push(convertedSelector.join(EMPTY));
                convertedSelector.length = 0;
                stream.advance();
            } else if (token.type === TokenType.Whitespace) {
                stream.advance();
            } else {
                throw new RuleConversionError(
                    sprintf(
                        ERROR_MESSAGES.UNEXPECTED_TOKEN_WITH_VALUE,
                        getFormattedTokenName(token.type),
                        source.slice(token.start, token.end),
                    ),
                );
            }
        }

        if (convertedSelector.length !== 0) {
            if (minLen !== NOT_SPECIFIED) {
                convertedSelector.push(renderAttrSelector(AttributeSelectors.MinLength, EQUALS, minLen.toString()));
            }
            convertedSelector.push(
                renderAttrSelector(
                    AttributeSelectors.MaxLength,
                    EQUALS,
                    maxLen !== NOT_SPECIFIED ? maxLen.toString() : ADG_HTML_CONVERSION_MAX_LENGTH.toString(),
                ),
            );
            convertedSelectorList.push(convertedSelector.join(EMPTY));
        }

        return createNodeConversionResult(
            // Since AdGuard HTML filtering rules do not support multiple selectors, we need to split each selector
            // into a separate rule node.
            convertedSelectorList.map((selector) => ({
                category: RuleCategory.Cosmetic,
                type: CosmeticRuleType.HtmlFilteringRule,
                syntax: AdblockSyntax.Adg,

                exception: rule.exception,
                domains: cloneDomainListNode(rule.domains),

                // Convert the separator based on the exception status
                separator: {
                    type: 'Value',
                    value: rule.exception
                        ? CosmeticRuleSeparator.AdgHtmlFilteringException
                        : CosmeticRuleSeparator.AdgHtmlFiltering,
                },

                body: {
                    type: 'Value',
                    value: unescapeDoubleQuotes(selector),
                },
            })),
            true,
        );
    }

    /**
     * Converts a HTML rule to uBlock Origin syntax, if possible.
     *
     * @note AdGuard rules are often more specific than uBlock Origin rules, so some information
     * may be lost in conversion. AdGuard's `[max-length]` and `[tag-content]` attributes will be converted to
     * uBlock's `:min-text-length()` and `:has-text()` pseudo-classes when possible.
     *
     * @param rule Rule node to convert
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws Error if the rule is invalid or cannot be converted
     */
    public static convertToUbo(rule: HtmlFilteringRule): NodeConversionResult<HtmlFilteringRule> {
        // Ignore uBlock Origin rules
        if (rule.syntax === AdblockSyntax.Ubo) {
            return createNodeConversionResult([rule], false);
        }

        if (rule.syntax === AdblockSyntax.Abp) {
            throw new RuleConversionError(ERROR_MESSAGES.ABP_NOT_SUPPORTED);
        }

        const source = escapeDoubleQuotes(rule.body.value);
        const stream = new CssTokenStream(source);

        const convertedSelector: string[] = [];
        let minTextLength: number | undefined;

        // Skip leading whitespace
        stream.skipWhitespace();

        while (!stream.isEof()) {
            const token = stream.getOrFail();

            if (token.type === TokenType.Ident) {
                convertedSelector.push(source.slice(token.start, token.end));
                stream.advance();
            } else if (token.type === TokenType.OpenSquareBracket) {
                // Attribute selectors
                const { start } = token;
                let tempToken;

                // Advance opening square bracket
                stream.advance();

                // Skip optional whitespace
                stream.skipWhitespace();

                // Parse attribute name
                tempToken = stream.getOrFail();

                if (tempToken.type !== TokenType.Ident) {
                    throw new RuleConversionError(
                        sprintf(
                            ERROR_MESSAGES.INVALID_ATTRIBUTE_NAME,
                            getFormattedTokenName(tempToken.type),
                            source.slice(tempToken.start, tempToken.end),
                        ),
                    );
                }

                const attr = source.slice(tempToken.start, tempToken.end);
                stream.advance();

                // Skip optional whitespace
                stream.skipWhitespace();

                // Check if this is a standalone attribute (like [disabled])
                tempToken = stream.getOrFail();
                if (tempToken.type === TokenType.CloseSquareBracket) {
                    const { end } = tempToken;
                    stream.advance();
                    convertedSelector.push(source.slice(start, end));
                    continue;
                }

                // Expect equals operator
                stream.expect(TokenType.Delim, { value: EQUALS });
                stream.advance();

                // Skip optional whitespace
                stream.skipWhitespace();

                // Parse attribute value
                tempToken = stream.getOrFail();
                if (tempToken.type !== TokenType.Ident && tempToken.type !== TokenType.String) {
                    throw new RuleConversionError(
                        sprintf(
                            ERROR_MESSAGES.INVALID_ATTRIBUTE_VALUE,
                            getFormattedTokenName(tempToken.type),
                            source.slice(tempToken.start, tempToken.end),
                        ),
                    );
                }

                const value = source.slice(tempToken.start, tempToken.end);
                stream.advance();

                // Skip optional whitespace
                stream.skipWhitespace();

                // Check for closing bracket
                tempToken = stream.getOrFail();

                if (tempToken.type !== TokenType.CloseSquareBracket) {
                    throw new RuleConversionError(sprintf(ERROR_MESSAGES.FLAGS_NOT_SUPPORTED));
                }
                const { end } = stream.getOrFail();
                stream.advance();

                // Handle special attributes with improved number parsing
                if (attr === AttributeSelectors.MinLength || attr === AttributeSelectors.MaxLength) {
                    const parsedValue = parseLengthValue(value, attr);
                    if (attr === AttributeSelectors.MinLength) {
                        minTextLength = parsedValue;
                    }
                } else if (attr === AttributeSelectors.TagContent) {
                    const unescapedValue = unescapeDoubleQuotes(value);
                    const valueWithoutQuotes = QuoteUtils.removeQuotes(unescapedValue);
                    convertedSelector.push(addPseudoClassWithValue(PseudoClasses.HasText, valueWithoutQuotes));
                } else {
                    convertedSelector.push(source.slice(start, end));
                }
            } else if (token.type === TokenType.Whitespace) {
                stream.advance();
            } else {
                throw new RuleConversionError(
                    sprintf(
                        ERROR_MESSAGES.UNEXPECTED_TOKEN_WITH_VALUE,
                        getFormattedTokenName(token.type),
                        source.slice(token.start, token.end),
                    ),
                );
            }
        }

        // Handle min length conversions
        if (minTextLength !== undefined) {
            convertedSelector.push(addPseudoClassWithValue(PseudoClasses.MinTextLength, minTextLength));
        }

        // Combine all selectors
        const uboSelector = `${convertedSelector.join(EMPTY)}`;

        return createNodeConversionResult(
            [{
                category: RuleCategory.Cosmetic,
                type: CosmeticRuleType.HtmlFilteringRule,
                syntax: AdblockSyntax.Ubo,

                exception: rule.exception,
                domains: cloneDomainListNode(rule.domains),

                separator: {
                    type: 'Value',
                    value: rule.exception
                        ? `${CosmeticRuleSeparator.ElementHidingException}${UBO_HTML_MASK}`
                        : `${CosmeticRuleSeparator.ElementHiding}${UBO_HTML_MASK}`,
                },

                body: {
                    type: 'Value',
                    value: unescapeDoubleQuotes(uboSelector),
                },
            }],
            true,
        );
    }
}
