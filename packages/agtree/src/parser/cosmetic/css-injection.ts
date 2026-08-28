/* eslint-disable no-bitwise, no-param-reassign */

/**
 * @file AdGuard CSS injection body structural parser.
 *
 * Parses CSS injection rule bodies of the forms:
 *   `selector { declarations }` and `@media prelude { selector { declarations } }`.
 *
 * Writes structural offsets to ctx.data with zero heap allocations.
 */

import { cssStringLength } from '../../css/tokenizer/css-token-mapping';
import { isCssIdentRun } from '../../css/tokenizer/css-token-utils';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { TokenType } from '../../tokenizer/token-types';
import type { ParserContext } from '../context';
import {
    lastNonWs,
    regionEquals,
    regionEqualsCI,
    skipWs,
    tokenStart,
} from '../context';
import type { StructuralParser } from '../types';

import {
    CSS_INJ_CLOSE_BRACE_TI,
    CSS_INJ_DL_END_TI,
    CSS_INJ_DL_SOURCE_END,
    CSS_INJ_DL_SOURCE_START,
    CSS_INJ_DL_START_TI,
    CSS_INJ_FLAG_HAS_MEDIA,
    CSS_INJ_FLAG_REMOVE,
    CSS_INJ_FLAGS,
    CSS_INJ_MEDIA_CLOSE_BRACE_TI,
    CSS_INJ_MEDIA_OPEN_BRACE_TI,
    CSS_INJ_MEDIA_QUERY_END,
    CSS_INJ_MEDIA_QUERY_START,
    CSS_INJ_MIN_DATA_SLOTS,
    CSS_INJ_OPEN_BRACE_TI,
    CSS_INJ_SL_END_TI,
    CSS_INJ_SL_SOURCE_END,
    CSS_INJ_SL_SOURCE_START,
    CSS_INJ_SL_START_TI,
} from './constants';

const MEDIA_KEYWORD = 'media';

/**
 * Scan forward for an OpenBrace token at a target brace depth, skipping
 * CSS strings via {@link cssStringLength} (handles bad-string, unterminated
 * strings, and `Escaped` tokens correctly).
 *
 * Same pattern as `CssAtRuleParser` Phase 3.
 *
 * @param types Token type array.
 * @param startTi Start token index.
 * @param endTi Exclusive end.
 * @param targetDepth The brace depth level at which to match (0 = first brace).
 *
 * @returns Token index of matching OpenBrace, or -1.
 */
function findOpenBrace(
    types: Uint8Array,
    startTi: number,
    endTi: number,
    targetDepth: number,
): number {
    let depth = 0;
    // Parenthesis depth: braces inside pseudo-class arguments (e.g.
    // `:contains(/[\w\W]{30,}/)`) must not be treated as the declaration
    // block, so only braces at parenthesis depth 0 are considered.
    let parenDepth = 0;
    let ti = startTi;
    while (ti < endTi) {
        // Skip CSS strings (Quote/Apostrophe delimited) — reuse the shared
        // utility so we correctly handle Escaped tokens, bad-string (LineBreak),
        // and unterminated strings.
        const strLen = cssStringLength(types, ti, endTi);
        if (strLen > 0) {
            ti += strLen;
            // eslint-disable-next-line no-continue
            continue;
        }
        const tt = types[ti];
        if (tt === TokenType.OpenParen) {
            parenDepth += 1;
        } else if (tt === TokenType.CloseParen) {
            if (parenDepth > 0) {
                parenDepth -= 1;
            }
        } else if (parenDepth === 0) {
            if (tt === TokenType.OpenBrace) {
                if (depth === targetDepth) {
                    return ti;
                }
                depth += 1;
            } else if (tt === TokenType.CloseBrace) {
                depth -= 1;
            }
        }
        ti += 1;
    }
    return -1;
}

/**
 * Scan forward for a CloseBrace token at a target brace depth, skipping
 * CSS strings via {@link cssStringLength}.
 *
 * Same pattern as `CssAtRuleParser` Phase 5.
 *
 * @param types Token type array.
 * @param startTi Start token index (should be after the corresponding OpenBrace).
 * @param endTi Exclusive end.
 * @param targetDepth The brace depth at which to stop (e.g. 0 for outermost close).
 *
 * @returns Token index of matching CloseBrace, or -1.
 */
function findCloseBrace(
    types: Uint8Array,
    startTi: number,
    endTi: number,
    targetDepth: number,
): number {
    let depth = targetDepth + 1; // we are inside the brace we want to close
    // Parenthesis depth: braces inside pseudo-class arguments must be ignored.
    let parenDepth = 0;
    let ti = startTi;
    while (ti < endTi) {
        // Skip CSS strings — same as findOpenBrace.
        const strLen = cssStringLength(types, ti, endTi);
        if (strLen > 0) {
            ti += strLen;
            // eslint-disable-next-line no-continue
            continue;
        }
        const tt = types[ti];
        if (tt === TokenType.OpenParen) {
            parenDepth += 1;
        } else if (tt === TokenType.CloseParen) {
            if (parenDepth > 0) {
                parenDepth -= 1;
            }
        } else if (parenDepth === 0) {
            if (tt === TokenType.OpenBrace) {
                depth += 1;
            } else if (tt === TokenType.CloseBrace) {
                depth -= 1;
                if (depth === targetDepth) {
                    return ti;
                }
            }
        }
        ti += 1;
    }
    return -1;
}

/**
 * Scan declaration tokens for `remove: true` pattern.
 * Also validates that `remove:` is only followed by `true`.
 *
 * Uses token types from the adblock tokenizer to locate candidates,
 * then falls back to source-text comparison (via `regionEquals`) only
 * for the actual keyword check — consistent with how other parsers
 * handle ident matching.
 *
 * Guards against partial-ident false positives (e.g. `no-remove: true`)
 * by checking that the `Letter` token for "remove" is not preceded by
 * a CSS ident-run token ({@link isCssIdentRun}).
 *
 * @param ctx Parser context.
 * @param dlStartTi Declaration list start token index.
 * @param dlEndTi Declaration list end token index (exclusive).
 *
 * @returns `true` if `remove: true` was found.
 *
 * @throws Error if `remove:` is followed by a value other than `true`.
 */
function detectRemoveTrue(
    ctx: ParserContext,
    dlStartTi: number,
    dlEndTi: number,
): boolean {
    const { types, ends, source } = ctx;
    const REMOVE = 'remove';
    const TRUE = 'true';

    for (let ti = dlStartTi; ti < dlEndTi; ti += 1) {
        // Look for Letter token
        if (types[ti] !== TokenType.Letter) {
            // eslint-disable-next-line no-continue
            continue;
        }

        // Guard: "remove" must be a standalone CSS ident, not a substring
        // of a larger ident like "no-remove". Check the preceding token is
        // not an ident-run token (Letter, Hyphen, Digit, Underscore,
        // NonAscii, Escaped).
        if (ti > dlStartTi && isCssIdentRun(types[ti - 1])) {
            // eslint-disable-next-line no-continue
            continue;
        }

        // Check if ident is exactly "remove" — regionEquals already
        // verifies length equality, but we add an explicit length guard
        // so correctness is self-evident without tracing into that helper.
        const identStart = ti === 0 ? ctx.sourceStart : ends[ti - 1];
        const identEnd = ends[ti];

        if (identEnd - identStart !== REMOVE.length
            || !regionEquals(source, identStart, identEnd, REMOVE)) {
            // eslint-disable-next-line no-continue
            continue;
        }

        // Next non-whitespace must be Colon
        let next = ti + 1;
        if (next < dlEndTi && types[next] === TokenType.Whitespace) {
            next += 1;
        }

        if (next >= dlEndTi || types[next] !== TokenType.Colon) {
            // eslint-disable-next-line no-continue
            continue;
        }

        // Skip past colon and optional whitespace
        next += 1;
        if (next < dlEndTi && types[next] === TokenType.Whitespace) {
            next += 1;
        }

        if (next >= dlEndTi) {
            // eslint-disable-next-line no-continue
            continue;
        }

        // Check value — must be an ident
        if (types[next] !== TokenType.Letter) {
            throw new AdblockSyntaxError(
                "Invalid 'remove' property value: the 'remove' property only accepts the value 'true'",
                tokenStart(ctx, next),
                ends[next],
            );
        }

        const valStart = ends[next - 1];
        const valEnd = ends[next];

        // Exact length + content match for "true".
        if (valEnd - valStart === TRUE.length
            && regionEquals(source, valStart, valEnd, TRUE)) {
            return true;
        }

        throw new AdblockSyntaxError(
            `Invalid 'remove' property value '${source.slice(valStart, valEnd)}': `
            + "the 'remove' property only accepts the value 'true'",
            valStart,
            valEnd,
        );
    }

    return false;
}

/**
 * Check if the token at `ti` starts an `@media` keyword.
 * Expects AtSign followed by Letter tokens spelling "media" (case-insensitive).
 *
 * @param ctx Parser context.
 * @param ti Token index of potential AtSign.
 * @param endTi Token limit.
 *
 * @returns Number of tokens consumed (AtSign + ident), or 0 if not @media.
 */
function matchAtMedia(ctx: ParserContext, ti: number, endTi: number): number {
    const { types, ends, source } = ctx;

    if (ti >= endTi || types[ti] !== TokenType.AtSign) {
        return 0;
    }

    // After @ we expect a letter token. The tokenizer may produce one Letter
    // token for the whole word "media" since consecutive letters are grouped.
    const identTi = ti + 1;
    if (identTi >= endTi || types[identTi] !== TokenType.Letter) {
        return 0;
    }

    const identStart = ends[ti]; // ident starts where @ ends
    const identEnd = ends[identTi];

    if (!regionEqualsCI(source, identStart, identEnd, MEDIA_KEYWORD)) {
        return 0;
    }

    return 2; // consumed AtSign + Letter
}

/**
 * Structural parser for AdGuard CSS injection rule bodies.
 *
 * Handles:
 * - `selector { declarations }` — plain CSS rule
 * - `@media prelude { selector { declarations } }` — @media wrapped.
 *
 * Writes 15-slot CSS injection header to ctx.data at dataOffset.
 * Zero heap allocations.
 *
 * Returns `true` when the body was successfully parsed as CSS injection.
 * When `required` is `false` and the body has no top-level brace (and no
 * `@media` prefix), returns `false` without writing any output — this
 * allows the caller to fall back to ABP snippet parsing **without a
 * separate disambiguation scan** (no double work).
 */
export class AdgCssInjectionParser implements StructuralParser {
    /**
     * Minimum ctx.data slots required.
     */
    public static readonly MIN_DATA_SLOTS = CSS_INJ_MIN_DATA_SLOTS;

    /**
     * Parse a CSS injection body.
     *
     * @param ctx Parser context with token data loaded.
     * @param startTi Inclusive start token index. Defaults to 0.
     * @param endTi Exclusive end token index. Defaults to ctx.tokenCount.
     * @param dataOffset Offset in ctx.data to write output. Defaults to 0.
     * @param required When `true` (default), throws if the body has no
     *   opening brace. When `false`, returns `false` instead — the caller
     *   can use this for `#$#` disambiguation without a separate brace scan.
     *
     * @returns `true` if the body was parsed as CSS injection, `false` if
     *   `required` is `false` and no top-level brace was found.
     */
    public static parse(
        ctx: ParserContext,
        startTi = 0,
        endTi = ctx.tokenCount,
        dataOffset = 0,
        required = true,
    ): boolean {
        const { types, ends, data } = ctx;
        const bodyStart = startTi > 0 ? ends[startTi - 1] : ctx.sourceStart;
        const bodyEnd = endTi > 0 && endTi <= ctx.tokenCount ? ends[endTi - 1] : bodyStart;

        // Skip leading whitespace
        const ti = skipWs(ctx, startTi);
        if (ti >= endTi) {
            throw new AdblockSyntaxError('CSS injection body is empty', bodyStart, bodyEnd);
        }

        // Detect @media prefix
        const atMediaLen = matchAtMedia(ctx, ti, endTi);
        let ruleStartTi: number; // token index where the CSS rule begins
        let outerCloseBraceTi = -1; // @media closing brace

        if (atMediaLen > 0) {
            // --- @media mode ---
            // @media always means CSS injection — even with required=false we
            // commit here (ABP snippets never start with @media).

            // Initialize header now (we're committed to CSS injection)
            data[dataOffset + CSS_INJ_FLAGS] = CSS_INJ_FLAG_HAS_MEDIA;
            data[dataOffset + CSS_INJ_MEDIA_QUERY_START] = -1;
            data[dataOffset + CSS_INJ_MEDIA_QUERY_END] = -1;
            data[dataOffset + CSS_INJ_MEDIA_OPEN_BRACE_TI] = -1;
            data[dataOffset + CSS_INJ_MEDIA_CLOSE_BRACE_TI] = -1;

            const afterKeyword = ti + atMediaLen; // past @media
            const mqStartTi = skipWs(ctx, afterKeyword);

            // Find outer open brace: @media prelude { ... }
            const outerOpenBraceTi = findOpenBrace(types, mqStartTi, endTi, 0);
            if (outerOpenBraceTi < 0) {
                throw new AdblockSyntaxError(
                    'Missing opening brace after @media prelude',
                    tokenStart(ctx, mqStartTi),
                    bodyEnd,
                );
            }

            data[dataOffset + CSS_INJ_MEDIA_OPEN_BRACE_TI] = outerOpenBraceTi;

            // Media query list = tokens between @media keyword and outer {
            const mqEndTi = lastNonWs(ctx, mqStartTi, outerOpenBraceTi);
            if (mqEndTi < 0) {
                throw new AdblockSyntaxError(
                    'Media query list is empty',
                    tokenStart(ctx, mqStartTi),
                    ends[outerOpenBraceTi],
                );
            }

            // Write media query source boundaries (trimmed)
            data[dataOffset + CSS_INJ_MEDIA_QUERY_START] = tokenStart(ctx, mqStartTi);
            data[dataOffset + CSS_INJ_MEDIA_QUERY_END] = ends[mqEndTi];

            // Find outer close brace
            outerCloseBraceTi = findCloseBrace(types, outerOpenBraceTi + 1, endTi, 0);
            if (outerCloseBraceTi < 0) {
                throw new AdblockSyntaxError(
                    'Missing closing brace for @media block',
                    ends[outerOpenBraceTi],
                    bodyEnd,
                );
            }

            data[dataOffset + CSS_INJ_MEDIA_CLOSE_BRACE_TI] = outerCloseBraceTi;

            // The inner CSS rule is between outer { and outer }
            ruleStartTi = skipWs(ctx, outerOpenBraceTi + 1);
        } else {
            ruleStartTi = ti;
        }

        // --- Parse CSS rule: selector { declarations } ---

        // Find the rule's open brace
        const innerOpenBraceTi = findOpenBrace(types, ruleStartTi, endTi, 0);
        if (innerOpenBraceTi < 0) {
            // No brace found. If not required (and no @media), return false
            // so the caller can fall back to ABP snippet parsing.
            if (!required && atMediaLen === 0) {
                return false;
            }
            throw new AdblockSyntaxError(
                'Missing opening brace in CSS injection body',
                tokenStart(ctx, ruleStartTi),
                bodyEnd,
            );
        }

        // We found a brace — if we haven't initialized the header yet
        // (non-@media path), do it now.
        if (atMediaLen === 0) {
            data[dataOffset + CSS_INJ_FLAGS] = 0;
            data[dataOffset + CSS_INJ_MEDIA_QUERY_START] = -1;
            data[dataOffset + CSS_INJ_MEDIA_QUERY_END] = -1;
            data[dataOffset + CSS_INJ_MEDIA_OPEN_BRACE_TI] = -1;
            data[dataOffset + CSS_INJ_MEDIA_CLOSE_BRACE_TI] = -1;
        }

        data[dataOffset + CSS_INJ_OPEN_BRACE_TI] = innerOpenBraceTi;

        // Selector list = tokens before inner open brace (trimmed)
        const slEndTi = lastNonWs(ctx, ruleStartTi, innerOpenBraceTi);
        if (slEndTi < 0) {
            throw new AdblockSyntaxError(
                'CSS injection selector list is empty',
                tokenStart(ctx, ruleStartTi),
                ends[innerOpenBraceTi],
            );
        }

        const slStartTi = skipWs(ctx, ruleStartTi);
        data[dataOffset + CSS_INJ_SL_SOURCE_START] = tokenStart(ctx, slStartTi);
        data[dataOffset + CSS_INJ_SL_SOURCE_END] = ends[slEndTi];
        data[dataOffset + CSS_INJ_SL_START_TI] = slStartTi;
        data[dataOffset + CSS_INJ_SL_END_TI] = slEndTi + 1;

        // Find the rule's close brace
        // When inside @media, search only up to outer close brace
        const closeBraceEndTi = outerCloseBraceTi >= 0 ? outerCloseBraceTi : endTi;
        const innerCloseBraceTi = findCloseBrace(types, innerOpenBraceTi + 1, closeBraceEndTi, 0);
        if (innerCloseBraceTi < 0) {
            throw new AdblockSyntaxError(
                'Missing closing brace in CSS injection body',
                ends[innerOpenBraceTi],
                outerCloseBraceTi >= 0 ? ends[outerCloseBraceTi] : bodyEnd,
            );
        }

        data[dataOffset + CSS_INJ_CLOSE_BRACE_TI] = innerCloseBraceTi;

        // Declaration list = tokens between inner { and inner } (trimmed)
        const dlCandidateStartTi = skipWs(ctx, innerOpenBraceTi + 1);
        const dlEndTi = lastNonWs(ctx, dlCandidateStartTi, innerCloseBraceTi);

        if (dlEndTi < 0) {
            throw new AdblockSyntaxError(
                'CSS injection declaration list is empty',
                ends[innerOpenBraceTi],
                ends[innerCloseBraceTi],
            );
        }

        const dlStartTi = dlCandidateStartTi;
        data[dataOffset + CSS_INJ_DL_SOURCE_START] = tokenStart(ctx, dlStartTi);
        data[dataOffset + CSS_INJ_DL_SOURCE_END] = ends[dlEndTi];
        data[dataOffset + CSS_INJ_DL_START_TI] = dlStartTi;
        data[dataOffset + CSS_INJ_DL_END_TI] = dlEndTi + 1;

        // Detect remove: true
        if (detectRemoveTrue(ctx, dlStartTi, dlEndTi + 1)) {
            data[dataOffset + CSS_INJ_FLAGS] |= CSS_INJ_FLAG_REMOVE;
        }

        return true;
    }
}
