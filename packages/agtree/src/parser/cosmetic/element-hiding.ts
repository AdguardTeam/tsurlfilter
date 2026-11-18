/* eslint-disable no-bitwise, no-param-reassign */

/**
 * @file Element hiding cosmetic rule parser.
 *
 * Handles ##, #@#, #?#, #@?# separators. Writes structural offsets to ctx.data
 * with zero heap allocations.
 */

import { UboPseudoName } from '../../common/ubo-selector-common';
import { cssStringLength, isCssStringUnterminated } from '../../css/tokenizer/css-token-mapping';
import { TokenType } from '../../tokenizer/token-types';
import { isExtendedCssPseudoClass } from '../../utils/extended-css-pseudo-classes';
import type { ParserContext } from '../context';
import { regionEquals, tokenStart } from '../context';
import { MODIFIER_FLAG_NEGATED, NO_VALUE } from '../network/constants';
import type { CosmeticBodyParser } from '../types';

import {
    CR_BODY_START_TI,
    CR_FLAG_BODY_ABP_CSS_INJECTION,
    CR_FLAG_HAS_ADG_MODS,
    CR_FLAG_HAS_UBO_MODS,
    CR_FLAGS_OFFSET,
    CR_MODIFIER_COUNT_OFFSET,
    CR_UBO_MODS_OFFSET,
    EH_MIN_DATA_SLOTS,
    UBO_MOD_BIT_MATCHES_MEDIA,
    UBO_MOD_BIT_MATCHES_PATH,
    UBO_MOD_BIT_REMOVE,
    UBO_MOD_BIT_STYLE,
    UBO_MOD_FIELD_FLAGS,
    UBO_MOD_FIELD_NAME_END,
    UBO_MOD_FIELD_NAME_START,
    UBO_MOD_FIELD_SRC_END,
    UBO_MOD_FIELD_SRC_START,
    UBO_MOD_FIELD_VALUE_END,
    UBO_MOD_FIELD_VALUE_START,
    UBO_MODIFIER_RECORD_STRIDE,
} from './constants';
import { parseCommonCosmeticHeader } from './cosmetic-common';

/**
 * Advance past a CSS pseudo-class name (`[A-Za-z]([A-Za-z-])*`).
 * Returns the exclusive end token index.
 *
 * @param types Token type array.
 * @param startTi First token index to scan.
 * @param limit Exclusive upper bound.
 *
 * @returns First token index after the name span.
 */
function skipPseudoName(types: Uint8Array, startTi: number, limit: number): number {
    let ti = startTi;
    // Letter (0) | Hyphen (1): types[ti] <= TokenType.Hyphen
    while (ti < limit && types[ti] <= TokenType.Hyphen) {
        ti += 1;
    }
    return ti;
}

/**
 * Whether a closing quote is followed by the end of the current attribute
 * selector: optional whitespace, an optional attribute flag, optional
 * whitespace, then `]`.
 *
 * A quote pair that does not end at the attribute boundary is not an attribute
 * value string. For example, in `[title='Don't']` the first quote pairs with
 * the apostrophe inside `Don't`, and the token after the pair is not `]`, so
 * the quote must stay a plain token. `[data-v="]"]` stays a string because its
 * closing quote is followed by `]`.
 *
 * @param types Token type array.
 * @param afterQuoteTi Token index right after the closing quote.
 * @param endTi Exclusive upper bound.
 *
 * @returns `true` if the attribute selector ends after the quote.
 */
function isAttributeSelectorEnd(
    types: Uint8Array,
    afterQuoteTi: number,
    endTi: number,
): boolean {
    let ti = afterQuoteTi;
    while (ti < endTi && types[ti] === TokenType.Whitespace) {
        ti += 1;
    }
    // Optional case-sensitivity flag (`i` or `s`).
    if (ti < endTi && types[ti] === TokenType.Letter) {
        ti += 1;
    }
    while (ti < endTi && types[ti] === TokenType.Whitespace) {
        ti += 1;
    }
    return ti < endTi && types[ti] === TokenType.CloseSquare;
}

/**
 * Length of a CSS string that starts at `ti`, or `0` when `ti` is not an
 * opening quote, `allowString` is `false`, the string is unterminated, or an
 * attribute string does not end at the attribute selector boundary.
 *
 * A quote is a CSS string delimiter only inside `[...]` or in a `:style()`
 * value. In an extended-CSS argument such as `:has-text(It's)` or
 * `:matches-path(/can't/)` it is plain text, so the caller decides whether a
 * string may start at `ti`. An unterminated quote is a plain token, matching
 * the behavior before string skipping.
 *
 * @param types Token type array.
 * @param ti Token index to check.
 * @param endTi Exclusive upper bound.
 * @param allowString Whether a CSS string may start at `ti`.
 * @param insideAttribute Whether `ti` is inside an attribute selector. When
 * `true`, the string must end at the attribute selector boundary.
 *
 * @returns Span length in tokens, or `0` if no terminated string starts here.
 */
function cssStringSpanLength(
    types: Uint8Array,
    ti: number,
    endTi: number,
    allowString: boolean,
    insideAttribute: boolean,
): number {
    if (!allowString) {
        return 0;
    }

    const t = types[ti];
    if (t !== TokenType.Quote && t !== TokenType.Apostrophe) {
        return 0;
    }

    const spanLength = cssStringLength(types, ti, endTi);
    if (isCssStringUnterminated(types, ti, spanLength)) {
        return 0;
    }

    if (insideAttribute && !isAttributeSelectorEnd(types, ti + spanLength, endTi)) {
        return 0;
    }

    return spanLength;
}

/**
 * Quote handling inside a raw extended-CSS argument.
 */
const enum RawQuoteMode {
    /**
     * Quotes are plain characters.
     */
    None = 0,

    /**
     * The argument starts with a quoted string; skip that string.
     */
    Quoted = 1,

    /**
     * XPath: quotes delimit string literals anywhere in the argument.
     */
    XPath = 2,
}

/**
 * Select the quote mode for a raw extended-CSS argument.
 *
 * Mirrors `pseudo-class-selector.ts`: a quoted argument uses CSS string
 * skipping, an XPath argument tracks quotes anywhere, and any other raw
 * argument treats quotes as plain text. The last rule keeps a lone apostrophe
 * in `:has-text(It's)` from swallowing the rest of the body.
 *
 * A quote that starts a string but never terminates does not enable string
 * skipping, so it stays a plain token.
 *
 * @param types Token type array.
 * @param openParenTi Index of the opening `(`.
 * @param endTi Exclusive upper bound.
 * @param isXpath Whether the argument belongs to `:xpath()`.
 *
 * @returns Quote mode for the argument scan.
 */
function getRawQuoteMode(
    types: Uint8Array,
    openParenTi: number,
    endTi: number,
    isXpath: boolean,
): RawQuoteMode {
    let peek = openParenTi + 1;
    while (peek < endTi && types[peek] === TokenType.Whitespace) {
        peek += 1;
    }

    if (peek < endTi && (types[peek] === TokenType.Quote || types[peek] === TokenType.Apostrophe)) {
        const spanLength = cssStringLength(types, peek, endTi);
        if (!isCssStringUnterminated(types, peek, spanLength)) {
            return RawQuoteMode.Quoted;
        }
    }

    return isXpath ? RawQuoteMode.XPath : RawQuoteMode.None;
}

/**
 * Whether a `Letter` token is a uBO regexp flag suffix, i.e. a run of `i`,
 * `m` and `u` letters.
 *
 * The uBO parser accepts a `:matches-path()` value as a regular expression
 * only when it matches `/^\/(.+)\/([imu]*)$/` (see `regexFromString()` in
 * uBO), so the suffix may contain these letters only.
 *
 * @param ctx Parser context.
 * @param ti Token index of the `Letter` token. The caller must pass a token
 * that is a `Letter`.
 *
 * @returns `true` if the token contains only `i`, `m` and `u` letters.
 */
function isUboRegexpFlags(ctx: ParserContext, ti: number): boolean {
    const start = tokenStart(ctx, ti);
    const end = ctx.ends[ti];
    for (let i = start; i < end; i += 1) {
        const ch = ctx.source.charCodeAt(i);
        // `i`, `m`, `u`
        if (ch !== 0x69 && ch !== 0x6D && ch !== 0x75) {
            return false;
        }
    }

    return start < end;
}

/**
 * Whether the value that ends at `ti` is a complete uBO regexp literal.
 *
 * A value is complete when the pattern is closed by a `/` delimiter that is
 * not the opening one, and only the optional uBO `[imu]` flags follow that
 * delimiter. For example, `/[(]/` and `/[)]/i` are complete, while the plain
 * values `/foo[` and `/foo/bar` are not.
 *
 * @param ctx Parser context.
 * @param ti Token index of the argument's closing `)`.
 * @param openParenTi Index of the opening `(` of the argument.
 *
 * @returns `true` if the value is a complete `/.../` or `/.../flags` literal.
 */
function endsRegexpLiteralAt(
    ctx: ParserContext,
    ti: number,
    openParenTi: number,
): boolean {
    const { types } = ctx;

    let start = openParenTi + 1;
    while (start < ti && types[start] === TokenType.Whitespace) {
        start += 1;
    }

    let prev = ti - 1;
    while (prev > start && types[prev] === TokenType.Whitespace) {
        prev -= 1;
    }

    if (types[prev] === TokenType.Letter) {
        // Flags must follow the closing `/` directly.
        if (!isUboRegexpFlags(ctx, prev)) {
            return false;
        }
        prev -= 1;
    }

    // The closing `/` must be a different token than the opening one, and the
    // pattern between them cannot be empty (uBO requires at least one
    // character).
    return prev > start + 1 && types[prev] === TokenType.Slash;
}

/**
 * Whether a `)` inside a character class belongs to that class.
 *
 * A plain `:matches-path()` value can contain `[`, for example `/foo[` or
 * `/[/`. Such a `[` is not a character class: reading it as one makes the
 * class swallow the argument's own `)` and latch onto a later `/` + `)` in
 * the rule. A class member `)` is therefore accepted only when the class
 * closes (a `]` appears) before the next parenthesis. For example, in
 * `/foo[):has-text(/]/)` the class would have to span `:has-text(`, so the
 * `)` ends the argument instead.
 *
 * @param types Token type array.
 * @param afterParenTi Token index right after the `)`.
 * @param endTi Exclusive upper bound.
 *
 * @returns `true` if the class closes before another parenthesis.
 */
function classClosesBeforeParen(
    types: Uint8Array,
    afterParenTi: number,
    endTi: number,
): boolean {
    let ti = afterParenTi;
    while (ti < endTi) {
        const t = types[ti];
        if (t === TokenType.CloseSquare) {
            return true;
        }
        if (t === TokenType.OpenParen || t === TokenType.CloseParen) {
            return false;
        }
        ti += 1;
    }
    return false;
}

/**
 * Find the closing `)` token of a `:matches-path()` argument whose value is a
 * complete regexp literal (`/.../` or `/.../imu`).
 *
 * The scan stops at the argument's own closing `)`. An escaped character and
 * any character inside a character class are plain text, so their parentheses
 * are not counted. A `)` that closes a group inside the regexp does not end
 * the argument either. A value is a regexp literal only when it ends with a
 * `/` delimiter, optionally followed by uBO `[imu]` flags, before the closing
 * `)`. A value that is not a complete literal (for example `/foo`, which some
 * lists use as plain text) is not a regexp literal, and the caller keeps the
 * balanced-parenthesis scan. The same applies to a plain value whose `[` is
 * not a character class, such as `/foo[` or `/[/`; see
 * {@link classClosesBeforeParen}.
 *
 * @param ctx Parser context.
 * @param openParenTi Index of the opening `(` of the argument.
 * @param endTi Exclusive upper bound.
 *
 * @returns Index of the closing `)` token, or `-1` if the value is not a
 * complete regexp literal.
 */
function findMatchesPathRegexpEnd(
    ctx: ParserContext,
    openParenTi: number,
    endTi: number,
): number {
    const { types } = ctx;

    let ti = openParenTi + 1;
    while (ti < endTi && types[ti] === TokenType.Whitespace) {
        ti += 1;
    }

    // A regexp literal starts with `/` as the first value character.
    if (ti >= endTi || types[ti] !== TokenType.Slash) {
        return -1;
    }
    ti += 1;

    let inClass = false;
    let parenDepth = 0;
    while (ti < endTi) {
        const t = types[ti];

        // An `Escaped` token (e.g. `\]` or `\)`) matches none of the checks
        // below, so it advances as plain text.
        if (inClass) {
            if (t === TokenType.CloseSquare) {
                inClass = false;
            } else if (t === TokenType.CloseParen
                && parenDepth === 0
                && !classClosesBeforeParen(types, ti + 1, endTi)) {
                // The `[` cannot be a class that closes before another
                // parenthesis, so this `)` ends a plain value. It is a
                // complete literal only if the value ends with `/` here.
                return endsRegexpLiteralAt(ctx, ti, openParenTi) ? ti : -1;
            }
            ti += 1;
            continue;
        }

        if (t === TokenType.OpenSquare) {
            inClass = true;
        } else if (t === TokenType.OpenParen) {
            parenDepth += 1;
        } else if (t === TokenType.CloseParen) {
            if (parenDepth > 0) {
                parenDepth -= 1;
            } else {
                // This is the argument boundary. The literal must end with
                // `/` here, otherwise the value is plain text.
                return endsRegexpLiteralAt(ctx, ti, openParenTi) ? ti : -1;
            }
        }

        ti += 1;
    }

    return -1;
}

/**
 * Options accepted by {@link ElementHidingParser.parse}.
 */
export interface ElementHidingParserOptions {
    /**
     * Whether to detect uBO modifiers in the rule body. Defaults to `true`.
     */
    parseUboSpecificRules?: boolean;
}

/**
 * Element hiding cosmetic rule parser.
 */
export class ElementHidingParser implements CosmeticBodyParser<ElementHidingParserOptions> {
    /**
     * Minimum `ctx.data` slots required by this parser with the default
     * uBO modifier capacity.
     *
     * @see {@link EH_MIN_DATA_SLOTS}
     */
    public static readonly MIN_DATA_SLOTS = EH_MIN_DATA_SLOTS;

    /**
     * Preparse an element hiding rule.
     *
     * @param ctx Parser context.
     * @param classified Packed classifier result (separator kind + index).
     * @param options Parser options.
     * @param startTi Inclusive token index where the rule starts. Defaults to 0.
     * @param endTi Exclusive token index where the rule ends. Defaults to `ctx.tokenCount`.
     *
     * @throws {Error} If body is empty or structure is invalid.
     */
    public static parse(
        ctx: ParserContext,
        classified: number,
        options?: ElementHidingParserOptions,
        startTi = 0,
        endTi = ctx.tokenCount,
    ): void {
        const parseUboSpecificRules = options?.parseUboSpecificRules ?? true;
        // Write common header (flags, sep, domains, bodyStart, bodyEnd, modCount, bodyStartTi)
        parseCommonCosmeticHeader(ctx, classified, 'Element hiding rule', startTi, endTi);

        // Read bodyStartTi from ctx.data (written by parseCommonCosmeticHeader)
        const bodyStartTi = ctx.data[CR_BODY_START_TI];

        // --- uBO modifier detection (three-tier gating) ---
        let uboModCount = 0;

        // Gate 1: option check
        if (parseUboSpecificRules) {
            // Gate 2: cheap candidate token scan
            const hasCandidate = ElementHidingParser.hasUboCandidate(
                ctx,
                bodyStartTi,
                endTi,
            );

            // Gate 3: full balanced scan (only if candidate found)
            if (hasCandidate) {
                uboModCount = ElementHidingParser.scanUboModifiers(
                    ctx,
                    bodyStartTi,
                    endTi,
                );
            }
        }

        if (uboModCount > 0) {
            ctx.data[CR_FLAGS_OFFSET] |= CR_FLAG_HAS_UBO_MODS;
        }

        // FR-013: reject mixed ADG + uBO modifiers
        // eslint-disable-next-line no-bitwise
        const hasAdgMods = (ctx.data[CR_FLAGS_OFFSET] & CR_FLAG_HAS_ADG_MODS) !== 0;
        if (hasAdgMods && uboModCount > 0) {
            throw new Error('Cannot mix AdGuard modifier list [$...] with uBO pseudo-class modifiers');
        }

        // Update modifier count if uBO modifiers were found
        if (uboModCount > 0) {
            ctx.data[CR_MODIFIER_COUNT_OFFSET] = uboModCount;
        }

        // ABP CSS injection detection: if no product-specific modifiers were
        // found, check whether the body matches the ABP CSS injection pattern:
        //   selector { declarations }
        //
        // Requirements for a positive match:
        //   1. Body ends with a CloseBrace token (ignoring trailing whitespace)
        //   2. There is a top-level OpenBrace (outside square brackets) that is
        //      not the very first non-whitespace token (there must be a selector)
        //   3. The OpenBrace has the matching CloseBrace at the end
        if (uboModCount === 0 && !hasAdgMods) {
            const { types } = ctx;

            // Find last non-whitespace token — must be CloseBrace
            let lastNonWsTi = endTi - 1;
            while (lastNonWsTi > bodyStartTi && types[lastNonWsTi] === TokenType.Whitespace) {
                lastNonWsTi -= 1;
            }

            if (lastNonWsTi > bodyStartTi && types[lastNonWsTi] === TokenType.CloseBrace) {
                // Scan for the matching top-level OpenBrace
                let bracketDepth = 0;
                for (let ti = bodyStartTi; ti < lastNonWsTi; ti += 1) {
                    const tt = types[ti];
                    if (tt === TokenType.OpenSquare) {
                        bracketDepth += 1;
                    } else if (tt === TokenType.CloseSquare) {
                        bracketDepth -= 1;
                    } else if (bracketDepth === 0 && tt === TokenType.OpenBrace) {
                        // Ensure there is selector content before the brace
                        // (at least one non-whitespace token before it)
                        let hasSelectorBefore = false;
                        for (let si = bodyStartTi; si < ti; si += 1) {
                            if (types[si] !== TokenType.Whitespace) {
                                hasSelectorBefore = true;
                                break;
                            }
                        }
                        if (hasSelectorBefore) {
                            ctx.data[CR_FLAGS_OFFSET] |= CR_FLAG_BODY_ABP_CSS_INJECTION;
                        }
                        break;
                    }
                }
            }
        }
    }

    /**
     * Cheap candidate check: linear scan of body tokens for any
     * Colon + Ident + OpenParen pattern whose ident matches a known uBO
     * modifier name.
     *
     * This gate is intentionally context-free: it may return `true` for
     * modifier-like text inside a quoted CSS string or inside an extended-CSS
     * argument, where {@link scanUboModifiers} then correctly finds no
     * modifier. A false positive only costs one extra scan, while keeping the
     * gate free of string and bracket tracking means an ambiguous bracket (for
     * example a literal `[` in a `:has-text()` argument) cannot produce a
     * false negative and hide a real modifier.
     *
     * Zero string allocations — uses regionEquals for comparison.
     *
     * @param ctx Parser context.
     * @param startTi First body token index.
     * @param endTi Token count boundary.
     *
     * @returns True if at least one uBO modifier candidate was found.
     */
    private static hasUboCandidate(
        ctx: ParserContext,
        startTi: number,
        endTi: number,
    ): boolean {
        const { types, ends, source } = ctx;

        for (let ti = startTi; ti < endTi - 1; ti += 1) {
            if (types[ti] !== TokenType.Colon) {
                continue;
            }

            const identEndTi = skipPseudoName(types, ti + 1, endTi);
            if (identEndTi === ti + 1 || identEndTi >= endTi || types[identEndTi] !== TokenType.OpenParen) {
                continue;
            }

            // Check if ident matches a known uBO modifier name
            const identStart = ends[ti]; // ident starts where colon ends
            const identEnd = ends[identEndTi - 1];

            if (
                regionEquals(source, identStart, identEnd, UboPseudoName.MatchesPath)
                || regionEquals(source, identStart, identEnd, UboPseudoName.MatchesMedia)
                || regionEquals(source, identStart, identEnd, UboPseudoName.Style)
                || regionEquals(source, identStart, identEnd, UboPseudoName.Remove)
            ) {
                return true;
            }

            // Also check for :not( wrapping :matches-path() or :matches-media()
            if (regionEquals(source, identStart, identEnd, 'not')) {
                // Look ahead inside :not() for a uBO modifier candidate.
                // Kept as a cheap early exit; the outer loop would reach the
                // same inner colon anyway (see AG-61882).
                for (let j = identEndTi + 1; j < endTi; j += 1) {
                    if (types[j] === TokenType.Colon) {
                        const innerEndTi = skipPseudoName(types, j + 1, endTi);
                        if (innerEndTi > j + 1 && innerEndTi < endTi && types[innerEndTi] === TokenType.OpenParen) {
                            const iStart = ends[j];
                            const iEnd = ends[innerEndTi - 1];
                            if (
                                regionEquals(source, iStart, iEnd, UboPseudoName.MatchesPath)
                                || regionEquals(source, iStart, iEnd, UboPseudoName.MatchesMedia)
                            ) {
                                return true;
                            }
                        }
                    }
                }
            }
        }

        return false;
    }

    /**
     * Full balanced scan: detect and record uBO modifiers in body tokens.
     * All state in local scalar variables — zero heap allocations.
     *
     * @param ctx Parser context.
     * @param startTi First body token index.
     * @param endTi Token count boundary.
     *
     * @returns Number of uBO modifier records written to ctx.data.
     */
    private static scanUboModifiers(
        ctx: ParserContext,
        startTi: number,
        endTi: number,
    ): number {
        const {
            types, ends, source, data,
        } = ctx;

        // Local scalar state — no allocations
        let depth = 0;
        let bracketDepth = 0;
        let seenMask = 0;
        let uboModCount = 0;

        // Raw extended-CSS argument tracking: `:has-text()`, `:matches-path()`,
        // `:xpath()` and similar take plain text, so `[` / `]` and quotes
        // inside them are not CSS syntax. `rawDepth` is the parenthesis depth
        // of the innermost open raw argument (0 = none), and `rawOpenAtTi` is
        // the `(` token that starts the argument being tracked.
        let rawDepth = 0;
        let rawOpenAtTi = -1;
        let rawOpenIsXpath = false;
        let rawQuoteMode = RawQuoteMode.None;
        let rawQuoteChar = 0;
        // Closing `)` of a complete `/.../` :matches-path() regexp value
        // (-1 = the value is not a regexp literal).
        let rawRegexpEndTi = -1;

        // Current open modifier state (-1 = no modifier open)
        let curModBit = 0;
        let curModNameStart = 0;
        let curModNameEnd = 0;
        let curModValueStartTi = 0;
        let curModSrcStart = 0;
        let curModException = 0;
        let curModNotCount = 0;
        let curModDepth = 0;
        let curModOpen = false;

        // Terminal modifier tracking (style/remove must be last)
        let terminalClosed = false;

        for (let ti = startTi; ti < endTi; ti += 1) {
            const t = types[ti];

            // FR-015: after :style()/:remove() closes, only whitespace allowed
            if (terminalClosed && t !== TokenType.Whitespace) {
                throw new Error(':style() and :remove() can only be used at the end of the selector');
            }

            // Inside a raw extended-CSS argument every character is plain
            // text: do not start a CSS string, count attribute brackets, or
            // detect modifiers there. Parentheses are still balanced to find
            // the end of the argument, except inside a quoted argument or an
            // XPath string literal.
            const insideRawArgument = rawDepth > 0;

            if (insideRawArgument) {
                // A complete `/.../` regexp value is raw text: its parentheses
                // and character classes do not change the depth. Skip to the
                // pre-scanned closing `)`.
                if (rawRegexpEndTi >= 0 && ti < rawRegexpEndTi) {
                    continue;
                }

                if (rawQuoteMode === RawQuoteMode.Quoted
                    && (t === TokenType.Quote || t === TokenType.Apostrophe)) {
                    // The whole argument is a quoted string, so its content
                    // cannot close the argument. `getRawQuoteMode()` verified
                    // that the string terminates.
                    ti += cssStringLength(types, ti, endTi) - 1;
                    rawQuoteMode = RawQuoteMode.None;
                    continue;
                }

                if (rawQuoteMode === RawQuoteMode.XPath
                    && (t === TokenType.Quote || t === TokenType.Apostrophe)) {
                    if (rawQuoteChar === 0) {
                        rawQuoteChar = t;
                    } else if (rawQuoteChar === t) {
                        rawQuoteChar = 0;
                    }
                    continue;
                }

                if (rawQuoteChar !== 0) {
                    // Inside an XPath string literal: parentheses are plain.
                    continue;
                }
            } else {
                // Skip a terminated CSS string span so that modifier-like text
                // and parentheses inside it do not affect the scan or the
                // depth. A quote is a CSS string delimiter only inside an
                // attribute selector whose value ends at `]`, or in a
                // `:style()` value.
                const insideStyleValue = curModOpen && curModBit === UBO_MOD_BIT_STYLE;
                const insideAttribute = bracketDepth > 0 && !insideStyleValue;
                const stringLength = cssStringSpanLength(
                    types,
                    ti,
                    endTi,
                    bracketDepth > 0 || insideStyleValue,
                    insideAttribute,
                );
                if (stringLength > 0) {
                    ti += stringLength - 1;
                    continue;
                }

                // Square-bracket depth is read only for string spans in
                // selector context. A `:style()` value is terminal and allows
                // strings itself, so a bracket there cannot change the scan
                // result.
                if (t === TokenType.OpenSquare) {
                    bracketDepth += 1;
                    continue;
                }

                if (t === TokenType.CloseSquare) {
                    if (bracketDepth > 0) {
                        bracketDepth -= 1;
                    }
                    continue;
                }
            }

            if (t === TokenType.OpenParen) {
                depth += 1;
                if (ti === rawOpenAtTi) {
                    rawDepth = depth;
                    rawOpenAtTi = -1;
                    rawQuoteMode = getRawQuoteMode(types, ti, endTi, rawOpenIsXpath);
                    rawOpenIsXpath = false;
                }
            } else if (t === TokenType.CloseParen) {
                depth -= 1;

                // Check if this closes the current open modifier
                if (curModOpen && depth < curModDepth) {
                    // Write record to ctx.data
                    const base = CR_UBO_MODS_OFFSET + uboModCount * UBO_MODIFIER_RECORD_STRIDE;
                    data[base + UBO_MOD_FIELD_NAME_START] = curModNameStart;
                    data[base + UBO_MOD_FIELD_NAME_END] = curModNameEnd;
                    data[base + UBO_MOD_FIELD_FLAGS] = curModException ? MODIFIER_FLAG_NEGATED : 0;

                    // Value is between the opening paren and this closing paren.
                    // Trim by skipping Whitespace tokens at the value's token-range
                    // boundaries (FR-013). Token-based trimming is one Uint8Array
                    // read per skip — much faster than scanning chars.
                    let firstValTi = curModValueStartTi;
                    let lastValTi = ti - 1; // token immediately before the closing paren
                    while (firstValTi <= lastValTi && types[firstValTi] === TokenType.Whitespace) {
                        firstValTi += 1;
                    }
                    while (lastValTi >= firstValTi && types[lastValTi] === TokenType.Whitespace) {
                        lastValTi -= 1;
                    }
                    if (firstValTi > lastValTi) {
                        // Empty or whitespace-only :style() / :remove() / etc.
                        data[base + UBO_MOD_FIELD_VALUE_START] = NO_VALUE;
                        data[base + UBO_MOD_FIELD_VALUE_END] = NO_VALUE;
                    } else {
                        data[base + UBO_MOD_FIELD_VALUE_START] = tokenStart(ctx, firstValTi);
                        data[base + UBO_MOD_FIELD_VALUE_END] = ends[lastValTi];
                    }

                    // Source range includes closing paren (and all :not() closing parens)
                    // For :not() wrappers, the source range extends to include their closing parens
                    let srcEnd = ends[ti]; // end of this closing paren

                    // If there are :not() wrappers, consume their closing parens
                    if (curModNotCount > 0) {
                        let remaining = curModNotCount;
                        let j = ti + 1;
                        while (remaining > 0 && j < endTi) {
                            const jt = types[j];
                            if (jt === TokenType.Whitespace) {
                                j += 1;
                                continue;
                            }
                            if (jt === TokenType.CloseParen) {
                                srcEnd = ends[j];
                                remaining -= 1;
                                depth -= 1;
                                j += 1;
                            } else {
                                // Non-whitespace, non-close-paren after negated modifier
                                throw new Error(
                                    'Negated :matches-path() cannot be followed by other tokens inside :not()',
                                );
                            }
                        }
                        ti = j - 1; // advance main loop past consumed tokens
                    }

                    data[base + UBO_MOD_FIELD_SRC_START] = curModSrcStart;
                    data[base + UBO_MOD_FIELD_SRC_END] = srcEnd;

                    uboModCount += 1;
                    curModOpen = false;

                    // Check if this was a terminal modifier
                    if (curModBit === UBO_MOD_BIT_STYLE || curModBit === UBO_MOD_BIT_REMOVE) {
                        terminalClosed = true;
                    }
                }

                // The closing parenthesis of a raw extended-CSS argument
                // returns the scan to normal selector context.
                if (rawDepth > 0 && depth < rawDepth) {
                    rawDepth = 0;
                    rawQuoteMode = RawQuoteMode.None;
                    rawQuoteChar = 0;
                    rawRegexpEndTi = -1;
                }

                continue;
            }

            // Modifier-like text inside a raw extended-CSS argument is plain
            // text, so do not detect modifiers there.
            if (insideRawArgument) {
                continue;
            }

            // Detect Colon + ident_span + OpenParen pattern
            if (t === TokenType.Colon) {
                const identEndTi = skipPseudoName(types, ti + 1, endTi);
                if (identEndTi === ti + 1 || identEndTi >= endTi || types[identEndTi] !== TokenType.OpenParen) {
                    continue;
                }

                const identStart = ends[ti];
                const identEnd = ends[identEndTi - 1];

                // Determine which modifier this is (if any)
                let modBit = 0;
                if (regionEquals(source, identStart, identEnd, UboPseudoName.MatchesPath)) {
                    modBit = UBO_MOD_BIT_MATCHES_PATH;
                } else if (regionEquals(source, identStart, identEnd, UboPseudoName.MatchesMedia)) {
                    modBit = UBO_MOD_BIT_MATCHES_MEDIA;
                } else if (regionEquals(source, identStart, identEnd, UboPseudoName.Style)) {
                    modBit = UBO_MOD_BIT_STYLE;
                } else if (regionEquals(source, identStart, identEnd, UboPseudoName.Remove)) {
                    modBit = UBO_MOD_BIT_REMOVE;
                }

                if (modBit !== 0) {
                    // FR-007: reject duplicates
                    if (seenMask & modBit) {
                        throw new Error(
                            `Duplicate uBO modifier: :${source.slice(identStart, identEnd)}()`,
                        );
                    }

                    if (depth > 0) {
                        // Nested modifier
                        if (modBit === UBO_MOD_BIT_MATCHES_PATH || modBit === UBO_MOD_BIT_MATCHES_MEDIA) {
                            // FR-004: :matches-path() / :matches-media() can be inside :not() wrappers
                            // Walk backwards to find and validate :not() wrappers
                            let exception = 0;
                            let notCount = 0;
                            let modSrcStart = tokenStart(ctx, ti); // start at colon

                            // Walk backwards looking for :not() wrappers
                            let j = ti - 1;
                            let wrapperDepth = depth;
                            while (wrapperDepth > 0 && j >= startTi) {
                                const jt = types[j];

                                if (jt === TokenType.Whitespace) {
                                    j -= 1;
                                    continue;
                                }

                                // Expect OpenParen
                                if (jt !== TokenType.OpenParen) {
                                    const modName = source.slice(identStart, identEnd);
                                    throw new Error(
                                        `Negated :${modName}() cannot be preceded by other tokens inside :not()`,
                                    );
                                }

                                // Before OpenParen should be Letter token for 'not'
                                if (j < 2 || types[j - 1] !== TokenType.Letter) {
                                    const modName = source.slice(identStart, identEnd);
                                    throw new Error(
                                        `:${modName}() can only be nested inside :not()`,
                                    );
                                }

                                const wrapNameStart = tokenStart(ctx, j - 1);
                                const wrapNameEnd = ends[j - 1];

                                if (!regionEquals(source, wrapNameStart, wrapNameEnd, 'not')) {
                                    const fn = source.slice(wrapNameStart, wrapNameEnd);
                                    const modName = source.slice(identStart, identEnd);
                                    throw new Error(
                                        `:${modName}() can only be nested inside :not(), found :${fn}()`,
                                    );
                                }

                                // Before Ident should be Colon
                                if (j < 3 || types[j - 2] !== TokenType.Colon) {
                                    const modName = source.slice(identStart, identEnd);
                                    throw new Error(
                                        `Expected colon before :not() wrapping :${modName}()`,
                                    );
                                }

                                exception ^= 1;
                                notCount += 1;
                                modSrcStart = tokenStart(ctx, j - 2); // extend to colon before :not
                                wrapperDepth -= 1;
                                j -= 3; // skip past colon + ident + open-paren
                            }

                            // Another modifier already open is not allowed
                            if (curModOpen) {
                                const modName = source.slice(identStart, identEnd);
                                throw new Error(
                                    `:${modName}() cannot be nested inside another uBO modifier`,
                                );
                            }

                            seenMask |= modBit;
                            curModBit = modBit;
                            curModNameStart = identStart;
                            curModNameEnd = identEnd;
                            curModSrcStart = modSrcStart;
                            curModException = exception;
                            curModNotCount = notCount;
                            curModDepth = depth + 1; // depth after the modifier's ( is opened
                            curModValueStartTi = identEndTi + 1; // first token after OpenParen
                            curModOpen = true;

                            // Skip ident span and OpenParen token
                            ti = identEndTi;
                            depth += 1;

                            // :matches-path() / :matches-media() values are
                            // raw text, not CSS selector syntax.
                            rawDepth = depth;
                            rawQuoteMode = getRawQuoteMode(types, identEndTi, endTi, false);
                            rawRegexpEndTi = modBit === UBO_MOD_BIT_MATCHES_PATH
                                ? findMatchesPathRegexpEnd(ctx, identEndTi, endTi)
                                : -1;
                        } else {
                            // FR-006: other modifiers cannot be nested
                            throw new Error(
                                `:${source.slice(identStart, identEnd)}() cannot be nested inside a pseudo-class`,
                            );
                        }
                    } else {
                        // Top-level modifier (depth === 0)
                        seenMask |= modBit;
                        curModBit = modBit;
                        curModNameStart = identStart;
                        curModNameEnd = identEnd;
                        curModSrcStart = tokenStart(ctx, ti); // start at colon
                        curModException = 0;
                        curModNotCount = 0;
                        curModDepth = depth + 1; // depth after the modifier's ( is opened
                        curModValueStartTi = identEndTi + 1; // first token after OpenParen
                        curModOpen = true;

                        // Skip ident span and OpenParen token
                        ti = identEndTi;
                        depth += 1;

                        // :matches-path() / :matches-media() values are raw
                        // text, not CSS selector syntax.
                        if (modBit === UBO_MOD_BIT_MATCHES_PATH || modBit === UBO_MOD_BIT_MATCHES_MEDIA) {
                            rawDepth = depth;
                            rawQuoteMode = getRawQuoteMode(types, identEndTi, endTi, false);
                            rawRegexpEndTi = modBit === UBO_MOD_BIT_MATCHES_PATH
                                ? findMatchesPathRegexpEnd(ctx, identEndTi, endTi)
                                : -1;
                        }
                    }
                } else if (isExtendedCssPseudoClass(source, identStart, identEnd)) {
                    // The argument of an Extended CSS pseudo-class is raw
                    // text: `[` / `]` and quotes inside it are plain
                    // characters, so the opening parenthesis starts a raw
                    // region instead of selector context.
                    rawOpenAtTi = identEndTi;
                    rawOpenIsXpath = regionEquals(source, identStart, identEnd, 'xpath');
                }
            }
        }

        return uboModCount;
    }
}
