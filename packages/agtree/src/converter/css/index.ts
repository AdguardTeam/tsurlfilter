import { TokenType, getFormattedTokenName } from '@adguard/css-tokenizer';
import { sprintf } from 'sprintf-js';

import {
    CLOSE_PARENTHESIS,
    COLON,
    COMMA,
    EMPTY,
    EQUALS,
    OPEN_PARENTHESIS,
} from '../../utils/constants';
import { ABP_EXT_CSS_PREFIX, LEGACY_EXT_CSS_ATTRIBUTE_PREFIX } from '../data/css';
import { BaseConverter } from '../base-interfaces/base-converter';
import { type ConversionResult, createConversionResult } from '../base-interfaces/conversion-result';
import { CssTokenStream } from '../../parser/css/css-token-stream';

export const ERROR_MESSAGES = {
    // eslint-disable-next-line max-len
    INVALID_ATTRIBUTE_VALUE: `Expected '${getFormattedTokenName(TokenType.Ident)}' or '${getFormattedTokenName(TokenType.String)}' as attribute value, but got '%s' with value '%s`,
};

export const PseudoClasses = {
    AbpContains: '-abp-contains',
    AbpHas: '-abp-has',
    Contains: 'contains',
    Has: 'has',
    HasText: 'has-text',
    MatchesCss: 'matches-css',
    MatchesCssAfter: 'matches-css-after',
    MatchesCssBefore: 'matches-css-before',
    Not: 'not',
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type PseudoClasses = typeof PseudoClasses[keyof typeof PseudoClasses];

export const PseudoElements = {
    After: 'after',
    Before: 'before',
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type PseudoElements = typeof PseudoElements[keyof typeof PseudoElements];

const PSEUDO_ELEMENT_NAMES = new Set<string>([
    PseudoElements.After,
    PseudoElements.Before,
]);

/**
 * CSS selector converter
 *
 * @todo Implement `convertToUbo` and `convertToAbp`
 */
export class CssSelectorConverter extends BaseConverter {
    /**
     * Converts Extended CSS elements to AdGuard-compatible ones
     *
     * @param selectorList Selector list to convert
     * @returns An object which follows the {@link ConversionResult} interface. Its `result` property contains
     * the converted node, and its `isConverted` flag indicates whether the original node was converted.
     * If the node was not converted, the result will contain the original node with the same object reference
     * @throws If the rule is invalid or incompatible
     */
    public static convertToAdg(selectorList: string | CssTokenStream): ConversionResult<string> {
        const stream = selectorList instanceof CssTokenStream
            ? selectorList
            : new CssTokenStream(selectorList);

        const converted: string[] = [];

        const convertAndPushPseudo = (pseudo: string): void => {
            switch (pseudo) {
                case PseudoClasses.AbpContains:
                case PseudoClasses.HasText:
                    converted.push(PseudoClasses.Contains);
                    converted.push(OPEN_PARENTHESIS);
                    break;

                case PseudoClasses.AbpHas:
                    converted.push(PseudoClasses.Has);
                    converted.push(OPEN_PARENTHESIS);
                    break;

                // a bit special case:
                // - `:matches-css-before(...)` → `:matches-css(before, ...)`
                // - `:matches-css-after(...)`  → `:matches-css(after, ...)`
                case PseudoClasses.MatchesCssBefore:
                case PseudoClasses.MatchesCssAfter:
                    converted.push(PseudoClasses.MatchesCss);
                    converted.push(OPEN_PARENTHESIS);
                    converted.push(pseudo.substring(PseudoClasses.MatchesCss.length + 1));
                    converted.push(COMMA);
                    break;

                default:
                    converted.push(pseudo);
                    converted.push(OPEN_PARENTHESIS);
                    break;
            }
        };

        while (!stream.isEof()) {
            const token = stream.getOrFail();

            if (token.type === TokenType.Colon) {
                // Advance colon
                stream.advance();
                converted.push(COLON);

                const tempToken = stream.getOrFail();

                // Double colon is a pseudo-element
                if (tempToken.type === TokenType.Colon) {
                    stream.advance();

                    converted.push(COLON);
                    continue;
                }

                if (tempToken.type === TokenType.Ident) {
                    const name = stream.source.slice(tempToken.start, tempToken.end);

                    if (PSEUDO_ELEMENT_NAMES.has(name)) {
                        // Add an extra colon to the name
                        converted.push(COLON);
                        converted.push(name);
                    } else {
                        // Add the name as is
                        converted.push(name);
                    }

                    // Advance the names
                    stream.advance();
                } else if (tempToken.type === TokenType.Function) {
                    const name = stream.source.slice(tempToken.start, tempToken.end - 1); // omit the last parenthesis

                    // :-abp-contains(...) → :contains(...)
                    // :has-text(...)      → :contains(...)
                    // :-abp-has(...)      → :has(...)
                    convertAndPushPseudo(name);

                    // Advance the function name
                    stream.advance();
                }
            } else if (token.type === TokenType.OpenSquareBracket) {
                let tempToken;
                const { start } = token;

                stream.advance();

                // Converts legacy Extended CSS selectors to the modern Extended CSS syntax.
                // For example:
                // - `[-ext-has=...]`                  → `:has(...)`
                // - `[-ext-contains=...]`             → `:contains(...)`
                // - `[-ext-matches-css-before=...]`   → `:matches-css(before, ...)`
                stream.skipWhitespace();

                stream.expect(TokenType.Ident);
                tempToken = stream.getOrFail();

                let attr = stream.source.slice(tempToken.start, tempToken.end);

                // Skip if the attribute name is not a legacy Extended CSS one
                if (!(attr.startsWith(LEGACY_EXT_CSS_ATTRIBUTE_PREFIX) || attr.startsWith(ABP_EXT_CSS_PREFIX))) {
                    converted.push(stream.source.slice(start, tempToken.end));
                    stream.advance();
                    continue;
                }

                if (attr.startsWith(LEGACY_EXT_CSS_ATTRIBUTE_PREFIX)) {
                    attr = attr.slice(LEGACY_EXT_CSS_ATTRIBUTE_PREFIX.length);
                }

                stream.advance();

                stream.skipWhitespace();

                // Next token should be an equality operator (=), because Extended CSS attribute selectors
                // do not support other operators
                stream.expect(TokenType.Delim, { value: EQUALS });
                stream.advance();

                // Skip optional whitespace after the operator
                stream.skipWhitespace();

                // Parse attribute value
                tempToken = stream.getOrFail();

                // According to the spec, attribute value should be an identifier or a string
                if (tempToken.type !== TokenType.Ident && tempToken.type !== TokenType.String) {
                    throw new Error(
                        sprintf(
                            ERROR_MESSAGES.INVALID_ATTRIBUTE_VALUE,
                            getFormattedTokenName(tempToken.type),
                            stream.source.slice(tempToken.start, tempToken.end),
                        ),
                    );
                }

                const value = stream.source.slice(tempToken.start, tempToken.end);

                // Advance the attribute value
                stream.advance();

                // Skip optional whitespace after the attribute value
                stream.skipWhitespace();

                // Next character should be a closing square bracket
                // We don't allow flags for Extended CSS attribute selectors
                stream.expect(TokenType.CloseSquareBracket);
                stream.advance();

                converted.push(COLON);
                convertAndPushPseudo(attr);
                let processedValue = value.slice(1, -1); // omit the quotes

                if (attr === PseudoClasses.Has) {
                    // TODO: Optimize this to avoid double tokenization
                    processedValue = CssSelectorConverter.convertToAdg(processedValue).result;
                }

                converted.push(processedValue);
                converted.push(CLOSE_PARENTHESIS);
            } else {
                converted.push(stream.source.slice(token.start, token.end));

                // Advance the token
                stream.advance();
            }
        }

        const convertedSelectorList = converted.join(EMPTY);
        return createConversionResult(convertedSelectorList, stream.source !== convertedSelectorList);
    }
}
