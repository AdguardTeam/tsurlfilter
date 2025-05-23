/**
 * @file Parser for AdGuard CSS injections.
 */

import { TokenType } from '@adguard/css-tokenizer';

import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { CSS_MEDIA_MARKER, EMPTY } from '../../utils/constants';
import { type Value, type CssInjectionRuleBody } from '../../nodes';
import { CssTokenStream } from './css-token-stream';
import { defaultParserOptions } from '../options';
import { BaseParser } from '../base-parser';

export const REMOVE_PROPERTY = 'remove';
export const REMOVE_VALUE = 'true';

export const ERROR_MESSAGES = {
    MEDIA_QUERY_LIST_IS_EMPTY: 'Media query list is empty',
    SELECTOR_LIST_IS_EMPTY: 'Selector list is empty',
    DECLARATION_LIST_IS_EMPTY: 'Declaration list is empty',
};

/**
 * Parser for AdGuard CSS injection.
 */
export class AdgCssInjectionParser extends BaseParser {
    /**
     * Parses an AdGuard CSS injection.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @returns Parsed AdGuard CSS injection {@link CssInjectionRuleBody}.
     * @throws An {@link AdblockSyntaxError} if the selector list is syntactically invalid.
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): CssInjectionRuleBody {
        let mediaQueryList: Value | undefined;
        const selectorList: Value = { type: 'Value', value: EMPTY };
        const declarationList: Value = { type: 'Value', value: EMPTY };

        const stream = new CssTokenStream(raw, baseOffset);

        // Skip leading whitespace characters
        stream.skipWhitespace();

        // We have two possible CSS injection formats:
        // 1. @media (media-query-list) { selector list { declarations separated by semicolons } }
        // 2. selector list { declarations separated by semicolons }

        // Handle '@media' case:
        let balanceShift = 0;

        if (stream.getOrFail().type === TokenType.AtKeyword) {
            // Currently only '@media' is supported, we should throw an error if we encounter anything else,
            // like '@supports' or '@charset', etc.
            stream.expect(TokenType.AtKeyword, { value: CSS_MEDIA_MARKER, balance: 0 });
            stream.advance();

            // Skip whitespace characters after @media keyword, if any
            // @media (media-query-list) { ...
            //       ↑
            //       └ this one (if any)
            stream.skipWhitespace();

            const mediaQueryListStart = stream.getOrFail().start;

            // Skip everything until we found the opening curly bracket of the declaration block
            // @media media-query-list { ...
            //                         ↑
            //                         └ this one
            let lastNonWsIndex = -1;

            while (!stream.isEof()) {
                const token = stream.getOrFail();

                if (token.type === TokenType.OpenCurlyBracket && token.balance === 1) {
                    break;
                }

                if (token.type !== TokenType.Whitespace) {
                    lastNonWsIndex = token.end;
                }

                stream.advance();
            }

            // If the skipped tokens count is 0 without leading and trailing whitespace characters, then the media query
            // list is empty
            if (lastNonWsIndex === -1) {
                throw new AdblockSyntaxError(
                    ERROR_MESSAGES.MEDIA_QUERY_LIST_IS_EMPTY,
                    baseOffset + mediaQueryListStart,
                    baseOffset + raw.length,
                );
            }

            // It is safe to use non-null assertion here, because we have already checked previous tokens.
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const mediaQueryListEnd = lastNonWsIndex;

            mediaQueryList = {
                type: 'Value',
                value: raw.slice(mediaQueryListStart, mediaQueryListEnd),
            };

            if (options.isLocIncluded) {
                mediaQueryList.start = baseOffset + mediaQueryListStart;
                mediaQueryList.end = baseOffset + mediaQueryListEnd;
            }

            // Next token should be an open curly bracket
            // @media (media-query-list) { ...
            //                           ↑
            //                           └ this one
            stream.expect(TokenType.OpenCurlyBracket);
            stream.advance();

            // '@media' at-rule wrap increases the balance level by 1 for the rule within the at-rule, because it
            // has its own { ... } block
            balanceShift = 1;
        }

        // Skip leading whitespace before the rule, if any
        // Note: rule = selector list { declarations separated by semicolons }
        stream.skipWhitespace();

        const selectorStart = stream.getOrFail().start;

        // Jump to the opening curly bracket of the declaration block, based on the balance level
        // .selector { padding-top: 10px; padding-bottom: 10px; }
        //           ↑
        //           └ this one
        const { skippedTrimmed: selectorTokensLength } = stream.skipUntilExt(
            TokenType.OpenCurlyBracket,
            balanceShift + 1,
        );
        stream.expect(TokenType.OpenCurlyBracket);

        // If the skipped tokens count is 0 without leading and trailing whitespace characters, then the selector list
        // is empty
        if (selectorTokensLength === 0) {
            throw new AdblockSyntaxError(
                ERROR_MESSAGES.SELECTOR_LIST_IS_EMPTY,
                baseOffset + selectorStart,
                baseOffset + raw.length,
            );
        }

        // It is safe to use non-null assertion here, because we have already checked previous tokens.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const selectorEnd = stream.lookbehindForNonWs()!.end;

        selectorList.value = raw.slice(selectorStart, selectorEnd);

        if (options.isLocIncluded) {
            selectorList.start = baseOffset + selectorStart;
            selectorList.end = baseOffset + selectorEnd;
        }

        // Jump to the next token after the opening curly bracket of the declaration block
        // .selector { padding-top: 10px; padding-bottom: 10px; }
        //            ↑
        //            └ this one
        stream.advance();

        // Skip whitespace characters after the opening curly bracket of the declaration block, if any
        stream.skipWhitespace();

        // Jump to the closing curly bracket of the declaration block, based on the balance level
        // .selector { padding-top: 10px; padding-bottom: 10px; }
        //                                                      ↑
        //                                                      └ this one
        const declarationsStart = stream.getOrFail().start;
        const declarations = new Set<string>();

        let declarationsEnd = -1;
        let remove = false;
        let lastNonWsIndex = -1;

        while (!stream.isEof()) {
            const token = stream.getOrFail();

            if (token.type === TokenType.CloseCurlyBracket && stream.getBalance() === balanceShift) {
                declarationsEnd = lastNonWsIndex;
                break;
            }

            if (token.type !== TokenType.Whitespace) {
                lastNonWsIndex = token.end;
            }

            if (token.type === TokenType.Ident && stream.lookahead()?.type === TokenType.Colon) {
                const ident = raw.slice(token.start, token.end);
                declarations.add(ident);

                // Consume ident and colon
                stream.advance();
                stream.advance();

                // only 'remove: true' is allowed
                if (ident === REMOVE_PROPERTY) {
                    // Skip whitespace after colon, if any
                    stream.skipWhitespace();

                    // Next token should be an ident, with value 'true'
                    stream.expect(TokenType.Ident, { value: REMOVE_VALUE });
                    stream.advance();

                    remove = true;
                }
            } else {
                stream.advance();
            }
        }

        if (declarationsEnd === -1) {
            throw new AdblockSyntaxError(
                ERROR_MESSAGES.DECLARATION_LIST_IS_EMPTY,
                baseOffset + declarationsStart,
                baseOffset + raw.length,
            );
        }

        declarationList.value = raw.slice(declarationsStart, declarationsEnd);

        if (options.isLocIncluded) {
            declarationList.start = baseOffset + declarationsStart;
            declarationList.end = baseOffset + declarationsEnd;
        }

        // Eat the close curly bracket of the declaration block
        // .selector { padding-top: 10px; padding-bottom: 10px; }
        //                                                      ↑
        //                                                      └ this one
        stream.expect(TokenType.CloseCurlyBracket);
        stream.advance();

        // Skip whitespace after the rule, if any
        stream.skipWhitespace();

        // If we have a media query, we should have an extra close curly bracket
        if (balanceShift === 1) {
            stream.expect(TokenType.CloseCurlyBracket);
            stream.advance();
        }

        const result: CssInjectionRuleBody = {
            type: 'CssInjectionRuleBody',
            selectorList,
            declarationList,
            remove,
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        if (mediaQueryList) {
            result.mediaQueryList = mediaQueryList;
        }

        return result;
    }
}
