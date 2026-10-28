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
import { CLOSE_PARENTHESIS } from '../../utils/constants';
import { SPECIAL_PSEUDO_CLASS_NAMES } from '../../utils/special-pseudo-classes';
import type { ParserContext } from '../context';
import { regionEquals, selectorListDataOffset, tokenStart } from '../context';
import {
    CHILD_FIELD_0,
    CHILD_FIELD_1,
    CHILD_FIELD_2,
    CHILD_FIELD_3,
    CHILD_FIELD_4,
    CHILD_FIELD_5,
    CHILD_FIELD_6,
    CHILD_FIELD_7,
    CHILD_FIELD_KIND,
    CHILD_FIELD_SOURCE_END,
    CHILD_FIELD_SOURCE_START,
    ChildKind,
    COMBINATOR_CHILD,
    COMBINATOR_DESCENDANT,
    COMBINATOR_NEXT_SIBLING,
    COMBINATOR_SUBSEQUENT_SIBLING,
    COMPLEX_FIELD_CHILD_COUNT,
    COMPLEX_FIELD_SOURCE_END,
    COMPLEX_FIELD_SOURCE_START,
    COMPLEX_STRIDE,
    DEFAULT_MAX_CHILDREN,
    DEFAULT_MAX_COMPLEX,
    NO_VALUE,
    SelectorListParser,
    SL_COUNT_OFFSET,
    SL_FLAGS_OFFSET,
    SL_HEADER_SIZE,
} from '../css/selector-list';
import { handleCombinator } from '../css/selector-list/combinator';
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
 * Special pseudo-class marker found in a raw HTML filtering rule body,
 * e.g. `:contains(` — see {@link SPECIAL_PSEUDO_CLASS_NAMES}.
 */
interface SpecialPseudoClassMarker {
    /**
     * Token index of the leading colon of the special pseudo-class marker.
     */
    markerTi: number;

    /**
     * Source start offset of the pseudo-class name.
     */
    nameStart: number;

    /**
     * Source end offset of the pseudo-class name.
     */
    nameEnd: number;

    /**
     * Token index of the opening parenthesis of the special pseudo-class marker.
     */
    openParenTi: number;
}

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
 * Maps an explicit combinator token type to its encoded combinator value.
 *
 * @param tokenType Token type to map.
 *
 * @returns Encoded combinator value, or `null` if the token is not an
 * explicit combinator.
 */
function getExplicitCombinatorValue(tokenType: number): number | null {
    switch (tokenType) {
        case TokenType.GreaterThan:
            return COMBINATOR_CHILD;
        case TokenType.PlusSign:
            return COMBINATOR_NEXT_SIBLING;
        case TokenType.Tilde:
            return COMBINATOR_SUBSEQUENT_SIBLING;
        default:
            return null;
    }
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
     * Bodies that are not syntactically correct CSS selector lists, but are
     * still accepted by AdGuard products (CoreLibs), are parsed leniently:
     * a special pseudo-class with a raw-text argument
     * (`:contains`, `:-abp-contains`, `:has-text`) may have an unbalanced
     * or unterminated argument, e.g. `script:contains((function(g,b,a,c,e,d)`,
     * which CoreLibs accepts — see {@link SPECIAL_PSEUDO_CLASS_NAMES}.
     *
     * @param ctx Parser context.
     * @param classified Packed classifier result.
     * @param startTi Inclusive token index where the rule starts. Defaults to 0.
     * @param endTi Exclusive token index where the rule ends. Defaults to `ctx.tokenCount`.
     *
     * @throws {AdblockSyntaxError} If the body is syntactically incorrect and
     * cannot be parsed leniently either.
     */
    public static parse(ctx: ParserContext, classified: number, startTi = 0, endTi = ctx.tokenCount): void {
        parseCommonCosmeticHeader(ctx, classified, 'ADG HTML filtering rule', startTi, endTi);
        ctx.data[CR_FLAGS_OFFSET] |= CR_SEP_KIND_ADG_HTML_FILTERING << CR_SEP_KIND_SHIFT;

        const bodyStartTi = ctx.data[CR_BODY_START_TI];

        try {
            SelectorListParser.parse(
                ctx,
                bodyStartTi,
                endTi,
                selectorListDataOffset(ctx),
                undefined,
                undefined,
                true, // isAdg
            );
        } catch (error) {
            // Tolerant fallback, mirroring CoreLibs: special pseudo-classes
            // with a raw-text argument accept arguments with unbalanced
            // parentheses or unterminated strings. Such bodies do not parse
            // as CSS selector lists, so we retry leniently here, taking the
            // argument as-is. If the body cannot be parsed leniently either,
            // the original error is rethrown.
            if (!(error instanceof AdblockSyntaxError)) {
                throw error;
            }

            if (!AdgHtmlFilteringParser.tryParseLenientSpecialPseudoClassArgument(ctx, bodyStartTi, endTi)) {
                throw error;
            }
        }
    }

    /**
     * Leniently parses a body whose last special pseudo-class has a
     * raw-text argument (unbalanced parentheses, unterminated string,
     * etc.), mirroring the CoreLibs behavior: the part of the body before
     * that pseudo-class is parsed as a regular selector list, and the
     * pseudo-class itself is written with the raw argument — the text
     * between the opening parenthesis of the pseudo-class and the last
     * closing parenthesis of the body.
     *
     * The structural selector list data in `ctx.data` is rewritten from
     * scratch: the prefix selector list is parsed first, then the
     * pseudo-class is appended to the last complex selector together with
     * the combinator in front of it, if any. The prefix may be empty
     * (`:contains(...)`), and it may end with an explicit combinator
     * (`div > :contains(...)`); both shapes are valid for CoreLibs.
     *
     * Only {@link AdblockSyntaxError} from the prefix parse means that the
     * body cannot be parsed leniently. Other errors are rethrown, so a real
     * parser bug is not masked as a syntax error.
     *
     * @param ctx Parser context.
     * @param startTi Inclusive token index where the body starts.
     * @param endTi Exclusive token index where the body ends.
     *
     * @returns `true` if the body was parsed leniently, `false` if it cannot
     * be parsed leniently (no special pseudo-class marker, argument not
     * closed by the last `)` of the body, or unparsable selector part
     * before it).
     */
    private static tryParseLenientSpecialPseudoClassArgument(
        ctx: ParserContext,
        startTi: number,
        endTi: number,
    ): boolean {
        const {
            types, ends, data, source,
        } = ctx;

        // CoreLibs requires the argument to be closed by the last `)` of the
        // body, so trailing whitespace is not a part of the argument
        let lastTi = endTi;
        while (lastTi > startTi && isCssWhitespace(types[lastTi - 1])) {
            lastTi -= 1;
        }

        // Check the last raw character rather than the token type: a trailing
        // escaped parenthesis (e.g. `foo\)`) is a single `Escaped` token, but
        // its last character still closes the argument, as in CoreLibs.
        if (lastTi <= startTi || source[ends[lastTi - 1] - 1] !== CLOSE_PARENTHESIS) {
            return false;
        }

        // Find the last special pseudo-class marker outside of quoted text
        const marker = AdgHtmlFilteringParser.findLastSpecialPseudoClassMarker(ctx, startTi, lastTi);

        if (marker === null) {
            return false;
        }

        // The raw argument: everything between the opening parenthesis of
        // the pseudo-class and the last closing parenthesis of the body
        const argStart = ends[marker.openParenTi];
        const argEnd = ends[lastTi - 1] - 1;

        // CoreLibs rejects empty arguments
        if (argEnd <= argStart) {
            return false;
        }

        const dataOffset = selectorListDataOffset(ctx);

        // The prefix is everything before the special pseudo-class. A trailing
        // explicit combinator (`div > :contains(...)`) is not a complete
        // selector list, so it is parsed separately and appended to the last
        // complex selector together with the pseudo-class.
        let prefixEndTi = marker.markerTi;
        let explicitCombinatorTi = -1;
        let explicitCombinatorValue: number | null = null;

        let prevTi = marker.markerTi - 1;
        while (prevTi >= startTi && isCssWhitespace(types[prevTi])) {
            prevTi -= 1;
        }

        if (prevTi >= startTi) {
            explicitCombinatorValue = getExplicitCombinatorValue(types[prevTi]);
            if (explicitCombinatorValue !== null) {
                explicitCombinatorTi = prevTi;
                prefixEndTi = prevTi;
            }
        }

        // The prefix may be empty (`:contains(...)`), which is valid for
        // CoreLibs and handled downstream by tswebextension. In that case,
        // start with one empty complex selector to append the pseudo-class to.
        const prefixStartTi = skipWsTokens(types, startTi, prefixEndTi);

        if (prefixStartTi >= prefixEndTi) {
            // A combinator cannot start a selector list
            if (explicitCombinatorTi !== -1) {
                return false;
            }

            data[dataOffset + SL_COUNT_OFFSET] = 1;
            data[dataOffset + SL_FLAGS_OFFSET] = 0;

            const emptyComplexBase = dataOffset + SL_HEADER_SIZE;
            data[emptyComplexBase + COMPLEX_FIELD_CHILD_COUNT] = 0;
            data[emptyComplexBase + COMPLEX_FIELD_SOURCE_START] = tokenStart(ctx, marker.markerTi);
            data[emptyComplexBase + COMPLEX_FIELD_SOURCE_END] = tokenStart(ctx, marker.markerTi);
        } else {
            // The part of the body before the special pseudo-class must be a
            // valid selector list; anything else (e.g. unbalanced brackets)
            // cannot be parsed leniently
            try {
                SelectorListParser.parse(
                    ctx,
                    startTi,
                    prefixEndTi,
                    dataOffset,
                    undefined,
                    undefined,
                    true, // isAdg
                );
            } catch (error) {
                if (error instanceof AdblockSyntaxError) {
                    return false;
                }

                throw error;
            }
        }

        const complexCount = SelectorListParser.complexCount(data, dataOffset);
        if (complexCount === 0) {
            return false;
        }

        // The pseudo-class extends the last compound selector of the last
        // complex selector, e.g. `script` in `script:contains(...)`
        const complexIdx = complexCount - 1;
        const complexBase = dataOffset + SL_HEADER_SIZE + complexIdx * COMPLEX_STRIDE;
        const childCount = data[complexBase + COMPLEX_FIELD_CHILD_COUNT];
        let childIdx = SelectorListParser.childStartIndex(data, dataOffset, complexIdx) + childCount;
        let appendedChildren = 0;

        if (explicitCombinatorTi !== -1 && explicitCombinatorValue !== null) {
            // Restore the explicit combinator that the prefix parser could not
            // consume because it ended the selector list
            if (childIdx >= DEFAULT_MAX_CHILDREN) {
                return false;
            }

            handleCombinator(
                ctx,
                explicitCombinatorTi,
                dataOffset,
                DEFAULT_MAX_COMPLEX,
                childIdx,
                explicitCombinatorValue,
                tokenStart(ctx, explicitCombinatorTi),
                ends[explicitCombinatorTi],
            );

            childIdx += 1;
            appendedChildren += 1;
            data[complexBase + COMPLEX_FIELD_SOURCE_END] = ends[explicitCombinatorTi];
        } else if (
            childCount > 0
            && marker.markerTi > startTi
            && isCssWhitespace(types[marker.markerTi - 1])
        ) {
            // If the pseudo-class is preceded by whitespace, the whitespace is
            // a descendant combinator, e.g. `div :has-text(...)`. The prefix
            // parser drops a trailing descendant space, so the combinator must
            // be restored explicitly — otherwise the appended pseudo-class
            // would be glued to the last compound selector, turning
            // `div :has-text(...)` into `div:contains(...)` with different
            // matching semantics (the whole `div` would match instead of the
            // matching descendant)
            if (childIdx >= DEFAULT_MAX_CHILDREN) {
                return false;
            }

            const wsTi = marker.markerTi - 1;
            handleCombinator(
                ctx,
                wsTi,
                dataOffset,
                DEFAULT_MAX_COMPLEX,
                childIdx,
                COMBINATOR_DESCENDANT,
                tokenStart(ctx, wsTi),
                ends[wsTi],
            );

            childIdx += 1;
            appendedChildren += 1;
        }

        if (childIdx >= DEFAULT_MAX_CHILDREN) {
            return false;
        }

        // Write the special pseudo-class child record with the raw argument
        const base = SelectorListParser.childBase(dataOffset, DEFAULT_MAX_COMPLEX, childIdx);

        data[base + CHILD_FIELD_KIND] = ChildKind.PseudoClassSelector;
        data[base + CHILD_FIELD_SOURCE_START] = tokenStart(ctx, marker.markerTi);
        data[base + CHILD_FIELD_SOURCE_END] = ends[lastTi - 1];
        data[base + CHILD_FIELD_0] = marker.nameStart;
        data[base + CHILD_FIELD_1] = marker.nameEnd;
        data[base + CHILD_FIELD_2] = argStart;
        data[base + CHILD_FIELD_3] = argEnd;
        data[base + CHILD_FIELD_4] = NO_VALUE;
        data[base + CHILD_FIELD_5] = NO_VALUE;
        data[base + CHILD_FIELD_6] = NO_VALUE;
        data[base + CHILD_FIELD_7] = NO_VALUE;

        appendedChildren += 1;

        // The appended pseudo-class (and the restored combinator, if any)
        // extends the last complex selector, so the parent ranges must be
        // extended to cover it — otherwise slicing the complex selector
        // range would omit the pseudo-class
        data[complexBase + COMPLEX_FIELD_CHILD_COUNT] = childCount + appendedChildren;
        data[complexBase + COMPLEX_FIELD_SOURCE_END] = ends[lastTi - 1];

        return true;
    }

    /**
     * Finds the last special pseudo-class marker (e.g. `:contains(`) in a
     * raw HTML filtering rule body, skipping over quoted text, where
     * marker-like substrings may occur as plain text of an argument or an
     * attribute value, e.g. the `:has-text(` in `[data-x=":has-text(foo"]`.
     *
     * Quote handling:
     * - both single and double quotes toggle the quoted state;
     * - an escaped quote (`\"`) is an `Escaped` token, so it does not toggle
     *   the quoted state;
     * - a doubled quote (`""`) inside a quoted section is treated as an
     *   escaped quote (AdGuard escaping convention for `[tag-content]` values).
     *
     * @param ctx Parser context.
     * @param startTi Inclusive token index to start scanning from.
     * @param endTi Exclusive token index to stop scanning at.
     *
     * @returns Last special pseudo-class marker, or `null` if none found.
     */
    private static findLastSpecialPseudoClassMarker(
        ctx: ParserContext,
        startTi: number,
        endTi: number,
    ): SpecialPseudoClassMarker | null {
        const {
            types, ends, source, sourceStart,
        } = ctx;

        let lastMarker: SpecialPseudoClassMarker | null = null;
        let quote: TokenType.Quote | TokenType.Apostrophe | 0 = 0;

        for (let ti = startTi; ti < endTi; ti += 1) {
            const tt = types[ti];

            if (quote !== 0) {
                // A doubled quote is an escaped quote
                // (AdGuard escaping convention for [tag-content] values)
                if (tt === quote) {
                    if (ti + 1 < endTi && types[ti + 1] === quote) {
                        ti += 1;
                        continue;
                    }

                    // Closing quote
                    quote = 0;
                }

                continue;
            }

            if (tt === TokenType.Quote || tt === TokenType.Apostrophe) {
                quote = tt;
                continue;
            }

            if (tt !== TokenType.Colon) {
                continue;
            }

            // Check whether the colon starts a special pseudo-class marker
            const nameTi = ti + 1;
            if (nameTi >= endTi) {
                continue;
            }

            const nameLen = cssIdentSequenceLength(types, nameTi, endTi, source, ends, sourceStart);
            if (nameLen === 0) {
                continue;
            }

            const nameStart = tokenStart(ctx, nameTi);
            const nameEnd = ends[nameTi + nameLen - 1];

            let isSpecial = false;
            for (const specialName of SPECIAL_PSEUDO_CLASS_NAMES) {
                if (regionEquals(source, nameStart, nameEnd, specialName)) {
                    isSpecial = true;
                    break;
                }
            }

            if (!isSpecial) {
                continue;
            }

            const openParenTi = nameTi + nameLen;
            if (openParenTi >= endTi || types[openParenTi] !== TokenType.OpenParen) {
                continue;
            }

            lastMarker = {
                markerTi: ti,
                nameStart,
                nameEnd,
                openParenTi,
            };
        }

        return lastMarker;
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
     * is NOT parsed. Used by {@link StructuralRuleParser} when
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
