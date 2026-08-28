/* eslint-disable no-bitwise, no-param-reassign */

/**
 * @file Element hiding cosmetic rule parser.
 *
 * Handles ##, #@#, #?#, #@?# separators. Writes structural offsets to ctx.data
 * with zero heap allocations.
 */

import { UboPseudoName } from '../../common/ubo-selector-common';
import { TokenType } from '../../tokenizer/token-types';
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
     * Colon + Ident pattern where the ident matches a known uBO modifier name.
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
                // Look ahead inside :not() for a uBO modifier candidate
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
        let seenMask = 0;
        let uboModCount = 0;

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

            if (t === TokenType.OpenParen) {
                depth += 1;
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
                    }
                }
            }
        }

        return uboModCount;
    }
}
