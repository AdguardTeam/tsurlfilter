/* eslint-disable no-bitwise, no-param-reassign, max-classes-per-file */

/**
 * @file HTML filtering cosmetic rule structural parsers.
 *
 * Two classes mirror the split between ADG ($$, $@$) and uBO (## / #@#
 * with ^ body prefix) HTML filtering syntax.  Each exposes a single
 * static `parse()` method that follows the same signature convention
 * used by {@link ElementHidingParser}.
 */

import { cssIdentSequenceLength } from '../../css/tokenizer/css-token-mapping';
import { isCssWhitespace } from '../../css/tokenizer/css-token-utils';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { TokenType } from '../../tokenizer/token-types';
import type { ParserContext } from '../context';
import { regionEquals, selectorListDataOffset, tokenStart } from '../context';
import { SelectorListParser } from '../css/selector-list';
import type { CosmeticBodyParser } from '../types';

import {
    CR_BODY_END,
    CR_BODY_START,
    CR_BODY_START_TI,
    CR_FLAG_BODY_UBO_RESPONSEHEADER,
    CR_FLAGS_OFFSET,
    CR_SEP_KIND_ADG_HTML_FILTERING,
    CR_SEP_KIND_SHIFT,
    CR_SEP_KIND_UBO_HTML_FILTERING,
    HF_ARG_END,
    HF_ARG_START,
    HF_FN_NAME_END,
    HF_FN_NAME_START,
    HF_MIN_DATA_SLOTS,
} from './constants';
import { parseCommonCosmeticHeader } from './cosmetic-common';

/**
 * String constant for responseheader function name comparison.
 */
const RESPONSEHEADER = 'responseheader';

/**
 * Skip whitespace and line-break tokens forward.
 *
 * @param types Token types buffer.
 * @param ti Start token index.
 * @param endTi Exclusive end token index.
 *
 * @returns First non-whitespace token index, or `endTi`.
 */
function skipWsTokens(types: Uint8Array, ti: number, endTi: number): number {
    let i = ti;
    while (i < endTi && isCssWhitespace(types[i])) {
        i += 1;
    }
    return i;
}

/**
 * Try to parse a `responseheader(...)` pattern starting at `startTi`.
 * If matched, writes function name and argument boundaries to `ctx.data`
 * and sets `CR_FLAG_BODY_UBO_RESPONSEHEADER`.
 *
 * @param ctx Parser context.
 * @param startTi Token index where the body starts (after ^ and whitespace).
 * @param endTi Exclusive token index where the rule ends.
 *
 * @returns True if a responseheader pattern was detected and parsed.
 *
 * @throws {AdblockSyntaxError} If the pattern is detected but malformed.
 */
function tryParseResponseHeader(
    ctx: ParserContext,
    startTi: number,
    endTi: number,
): boolean {
    const {
        types, ends, source, sourceStart,
    } = ctx;

    // Check for ident run matching "responseheader"
    const identLen = cssIdentSequenceLength(types, startTi, endTi, source, ends, sourceStart);
    if (identLen === 0) {
        return false;
    }

    const fnNameStart = tokenStart(ctx, startTi);
    const fnNameEnd = ends[startTi + identLen - 1];

    if (!regionEquals(source, fnNameStart, fnNameEnd, RESPONSEHEADER)) {
        return false;
    }

    // Next token must be OpenParen with no whitespace between name and (
    const openParenTi = startTi + identLen;
    if (openParenTi >= endTi || types[openParenTi] !== TokenType.OpenParen) {
        return false;
    }

    // It's a responseheader( pattern — parse argument
    let ti = openParenTi + 1;
    ti = skipWsTokens(types, ti, endTi);

    // Find closing paren (balanced)
    const argStartTi = ti;
    let depth = 1;

    while (ti < endTi && depth > 0) {
        if (types[ti] === TokenType.OpenParen) {
            depth += 1;
        } else if (types[ti] === TokenType.CloseParen) {
            depth -= 1;
            if (depth === 0) {
                break;
            }
        }
        ti += 1;
    }

    if (depth !== 0 || ti >= endTi) {
        const errPos = ti > 0 ? ends[ti - 1] : ends[openParenTi];
        throw new AdblockSyntaxError(
            "Expected '<)-token>', but got 'end of input'",
            errPos - 1,
            errPos,
        );
    }

    // ti now points at the CloseParen token
    const closeParenTi = ti;

    // Compute argument boundaries (trimmed)
    const argStart = argStartTi < closeParenTi
        ? tokenStart(ctx, argStartTi)
        : tokenStart(ctx, closeParenTi);

    // Find last non-whitespace token before CloseParen for trimmed end
    let argEndTi = closeParenTi;
    while (argEndTi > argStartTi && isCssWhitespace(types[argEndTi - 1])) {
        argEndTi -= 1;
    }
    const argEnd = argEndTi > argStartTi ? ends[argEndTi - 1] : argStart;

    // Validate argument is not empty
    if (argEnd <= argStart) {
        throw new AdblockSyntaxError(
            `Empty parameter for '${RESPONSEHEADER}' function`,
            tokenStart(ctx, closeParenTi),
            ends[closeParenTi],
        );
    }

    // Advance past CloseParen
    ti = closeParenTi + 1;

    // Skip trailing whitespace
    ti = skipWsTokens(types, ti, endTi);

    // Nothing should remain after closing paren
    if (ti < endTi) {
        const tokStart = tokenStart(ctx, ti);
        const tokEnd = ends[ti];
        throw new AdblockSyntaxError(
            `Expected end of rule, but got '${source.slice(tokStart, tokEnd)}'`,
            tokStart,
            tokEnd,
        );
    }

    // Write responseheader data
    ctx.data[CR_FLAGS_OFFSET] |= CR_FLAG_BODY_UBO_RESPONSEHEADER;
    ctx.data[HF_FN_NAME_START] = fnNameStart;
    ctx.data[HF_FN_NAME_END] = fnNameEnd;
    ctx.data[HF_ARG_START] = argStart;
    ctx.data[HF_ARG_END] = argEnd;

    return true;
}

/**
 * ADG HTML filtering rule parser ($$, $@$).
 *
 * Invokes `SelectorListParser` with `isAdg=true` to handle the `""`
 * escape convention in double-quoted attribute selector values.
 */
export class AdgHtmlFilteringParser implements CosmeticBodyParser {
    /**
     * Minimum `ctx.data` slots required by this parser.
     */
    public static readonly MIN_DATA_SLOTS = HF_MIN_DATA_SLOTS;

    /**
     * Parse an ADG HTML filtering rule.
     *
     * @param ctx Parser context.
     * @param classified Packed classifier result.
     * @param startTi Inclusive token index where the rule starts. Defaults to 0.
     * @param endTi Exclusive token index where the rule ends. Defaults to `ctx.tokenCount`.
     */
    public static parse(ctx: ParserContext, classified: number, startTi = 0, endTi = ctx.tokenCount): void {
        parseCommonCosmeticHeader(ctx, classified, 'ADG HTML filtering rule', startTi, endTi);
        ctx.data[CR_FLAGS_OFFSET] |= CR_SEP_KIND_ADG_HTML_FILTERING << CR_SEP_KIND_SHIFT;

        const bodyStartTi = ctx.data[CR_BODY_START_TI];
        SelectorListParser.parse(
            ctx,
            bodyStartTi,
            endTi,
            selectorListDataOffset(ctx),
            undefined,
            undefined,
            true, // isAdg
        );
    }
}

/**
 * Options accepted by {@link UboHtmlFilteringParser.parse}.
 */
export interface UboHtmlFilteringParserOptions {
    /**
     * Whether uBO-specific rules are allowed. When `false`, the parser
     * throws on any rule that uses uBO HTML filtering syntax. Defaults to `true`.
     */
    parseUboSpecificRules?: boolean;

    /**
     * When `true`, only the cosmetic header is written and the parser
     * exits after marking the sub-kind and advancing past the leading
     * `^` (and `responseheader(...)` if present). The CSS selector list
     * is NOT parsed. Used by {@link RuleParser} when
     * `parseHtmlFilteringRuleBodies` is `false`. Defaults to `false`.
     */
    onlyHeader?: boolean;
}

/**
 * Parser for uBO HTML filtering rules (## / #@# with ^ body prefix).
 *
 * Skips past the leading `^`, then either detects `responseheader(...)`
 * or falls through to `SelectorListParser.parse()` for CSS selectors.
 */
export class UboHtmlFilteringParser implements CosmeticBodyParser<UboHtmlFilteringParserOptions> {
    /**
     * Minimum `ctx.data` slots required by this parser.
     */
    public static readonly MIN_DATA_SLOTS = HF_MIN_DATA_SLOTS;

    /**
     * Parse a uBO HTML filtering rule.
     *
     * @param ctx Parser context.
     * @param classified Packed classifier result.
     * @param options Parser options.
     * @param startTi Inclusive token index where the rule starts. Defaults to 0.
     * @param endTi Exclusive token index where the rule ends. Defaults to `ctx.tokenCount`.
     */
    public static parse(
        ctx: ParserContext,
        classified: number,
        options?: UboHtmlFilteringParserOptions,
        startTi = 0,
        endTi = ctx.tokenCount,
    ): void {
        const parseUboSpecificRules = options?.parseUboSpecificRules ?? true;
        const onlyHeader = options?.onlyHeader ?? false;

        parseCommonCosmeticHeader(ctx, classified, 'uBO HTML filtering rule', startTi, endTi);

        const { types, ends } = ctx;
        let bodyStartTi = ctx.data[CR_BODY_START_TI];

        // Body must start with ^ (Caret token)
        if (bodyStartTi >= endTi || types[bodyStartTi] !== TokenType.Caret) {
            throw new AdblockSyntaxError(
                'Expected ^ at the start of uBO HTML filtering rule body',
                ctx.data[CR_BODY_START],
                ctx.data[CR_BODY_END],
            );
        }

        if (!parseUboSpecificRules) {
            throw new AdblockSyntaxError(
                "Parsing uBO-specific rules is disabled, but the rule uses uBO HTML filtering syntax ('^')",
                tokenStart(ctx, bodyStartTi),
                ends[bodyStartTi],
            );
        }

        // Set sub-kind
        ctx.data[CR_FLAGS_OFFSET] |= CR_SEP_KIND_UBO_HTML_FILTERING << CR_SEP_KIND_SHIFT;

        // Skip ^ and following whitespace
        bodyStartTi += 1;
        bodyStartTi = skipWsTokens(types, bodyStartTi, endTi);

        if (bodyStartTi >= endTi) {
            throw new AdblockSyntaxError(
                'Empty uBO HTML filtering rule body after ^',
                ctx.data[CR_BODY_START],
                ctx.data[CR_BODY_END],
            );
        }

        // Update body start to after ^ + whitespace
        ctx.data[CR_BODY_START] = tokenStart(ctx, bodyStartTi);
        ctx.data[CR_BODY_START_TI] = bodyStartTi;

        // Try to detect responseheader(...)
        if (tryParseResponseHeader(ctx, bodyStartTi, endTi)) {
            return;
        }

        if (onlyHeader) {
            return;
        }

        // Regular uBO HTML filtering: parse body as CSS selector list
        SelectorListParser.parse(
            ctx,
            bodyStartTi,
            endTi,
            selectorListDataOffset(ctx),
        );
    }
}
