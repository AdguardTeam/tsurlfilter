/* eslint-disable no-bitwise, no-param-reassign */

/**
 * @file Element hiding cosmetic rule preparser.
 *
 * Handles ##, #@#, #?#, #@?# separators. Writes structural offsets to ctx.data
 * with zero heap allocations.
 */

import { UboPseudoName } from '../../common/ubo-selector-common';
import { TokenType } from '../../tokenizer/token-types';
import { RuleClassifier } from '../classifier';
import type { PreparserContext } from '../context';
import { regionEquals, skipWs, tokenStart } from '../context';
import { DomainListPreparser } from '../misc/domain-list';
import { ModifierListPreparser } from '../misc/modifier-list';
import { MODIFIER_FLAG_NEGATED, NO_VALUE, NR_MODIFIER_COUNT_OFFSET } from '../network/constants';

import {
    cosmeticSepIsException,
    cosmeticSepTokenCount,
    CR_BODY_START,
    CR_DOMAIN_COUNT,
    CR_FLAG_EXCEPTION,
    CR_FLAG_HAS_ADG_MODS,
    CR_FLAG_HAS_UBO_MODS,
    CR_FLAGS_OFFSET,
    CR_SEP_KIND_MASK,
    CR_SEP_KIND_SHIFT,
    CR_SEP_SOURCE_START,
    CR_UBO_MODS_OFFSET,
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

/**
 * Element hiding cosmetic rule preparser.
 */
export class ElementHidingPreparser {
    /**
     * Preparse an element hiding rule.
     *
     * @param ctx Preparser context.
     * @param classified Packed (sepKind, sepTokenIndex) from cosmetic separator finder.
     * @param parseUboSpecificRules Whether to detect uBO modifiers (default true).
     *
     * @throws {Error} If body is empty or structure is invalid.
     */
    public static preparse(ctx: PreparserContext, classified: number, parseUboSpecificRules = true): void {
        const { types, source } = ctx;

        // Unpack separator kind and token index
        const sepKind = RuleClassifier.cosmeticSepKind(classified);
        const sepTokenIndex = RuleClassifier.cosmeticSepIndex(classified);

        // Compute separator source position
        const sepSourceStart = tokenStart(ctx, sepTokenIndex);

        // Detect AdGuard modifier list prefix: [$...]
        let domainStartTi = 0;
        let modCount = 0;
        let hasAdgMods = false;

        if (types[0] === TokenType.OpenSquare && types[1] === TokenType.DollarSign) {
            // Find closing ] with bracket depth tracking
            // Start at depth 1 (after the opening [)
            const closeBracketTi = ElementHidingPreparser.findClosingBracket(ctx, 1, sepTokenIndex);

            if (closeBracketTi < 0) {
                throw new Error('Unclosed AdGuard modifier list: missing ]');
            }

            // Parse modifier list between $ and ]
            // Temporarily scope tokenCount so ModifierListPreparser stops at ]
            const savedTokenCount = ctx.tokenCount;
            ctx.tokenCount = closeBracketTi;
            modCount = ModifierListPreparser.preparse(ctx, 2); // start after $
            ctx.tokenCount = savedTokenCount;

            hasAdgMods = true;
            domainStartTi = skipWs(ctx, closeBracketTi + 1);
        }

        const domainEndTi = sepTokenIndex;

        // Parse domain list (comma-separated)
        const domainCount = DomainListPreparser.preparse(
            ctx,
            domainStartTi,
            domainEndTi,
            TokenType.Comma,
        );

        // Body starts after separator (skip all separator tokens)
        const sepTokens = cosmeticSepTokenCount(sepKind);
        const bodyCandidateTi = sepTokenIndex + sepTokens;
        const bodyStartTi = skipWs(ctx, bodyCandidateTi);

        // Validate body is non-empty
        if (bodyStartTi >= ctx.tokenCount) {
            throw new Error('Element hiding rule has empty body');
        }

        const bodyStart = tokenStart(ctx, bodyStartTi);

        // Validate body has content (not just whitespace)
        const bodyEnd = source.length;
        let trimmedEnd = bodyEnd;
        while (trimmedEnd > bodyStart && /\s/.test(source[trimmedEnd - 1])) {
            trimmedEnd -= 1;
        }

        if (trimmedEnd <= bodyStart) {
            throw new Error('Element hiding rule has empty body');
        }

        // Pack flags
        let flags = 0;
        if (cosmeticSepIsException(sepKind)) {
            flags |= CR_FLAG_EXCEPTION;
        }
        flags |= (sepKind & CR_SEP_KIND_MASK) << CR_SEP_KIND_SHIFT;
        if (hasAdgMods) {
            flags |= CR_FLAG_HAS_ADG_MODS;
        }

        // --- uBO modifier detection (three-tier gating) ---
        let uboModCount = 0;

        // Gate 1: option check
        if (parseUboSpecificRules) {
            // Gate 2: cheap candidate token scan
            const hasCandidate = ElementHidingPreparser.hasUboCandidate(ctx, bodyStartTi, ctx.tokenCount);

            // Gate 3: full balanced scan (only if candidate found)
            if (hasCandidate) {
                uboModCount = ElementHidingPreparser.scanUboModifiers(ctx, bodyStartTi, ctx.tokenCount);
            }
        }

        if (uboModCount > 0) {
            flags |= CR_FLAG_HAS_UBO_MODS;
        }

        // FR-013: reject mixed ADG + uBO modifiers
        if (hasAdgMods && uboModCount > 0) {
            throw new Error('Cannot mix AdGuard modifier list [$...] with uBO pseudo-class modifiers');
        }

        // Write header
        ctx.data[CR_FLAGS_OFFSET] = flags;
        ctx.data[CR_SEP_SOURCE_START] = sepSourceStart;
        ctx.data[CR_DOMAIN_COUNT] = domainCount;
        ctx.data[CR_BODY_START] = bodyStart;
        ctx.data[NR_MODIFIER_COUNT_OFFSET] = uboModCount > 0 ? uboModCount : modCount;
    }

    /**
     * Find the closing bracket token (]) that matches the opening [.
     * Tracks bracket depth to handle nested brackets (e.g. regex character classes).
     * Skips Escaped tokens to handle \].
     *
     * @param ctx Preparser context.
     * @param startTi Token index to start scanning from (after the opening [).
     * @param endTi Token index boundary (exclusive).
     *
     * @returns Token index of the closing ], or -1 if not found.
     */
    private static findClosingBracket(
        ctx: PreparserContext,
        startTi: number,
        endTi: number,
    ): number {
        const { types } = ctx;
        let depth = 1;

        for (let ti = startTi; ti < endTi; ti += 1) {
            const t = types[ti];

            if (t === TokenType.Escaped) {
                continue;
            }

            if (t === TokenType.OpenSquare) {
                depth += 1;
            } else if (t === TokenType.CloseSquare) {
                depth -= 1;
                if (depth === 0) {
                    return ti;
                }
            }
        }

        return -1;
    }

    /**
     * Cheap candidate check: linear scan of body tokens for any
     * Colon + Ident pattern where the ident matches a known uBO modifier name.
     * Zero string allocations — uses regionEquals for comparison.
     *
     * @param ctx Preparser context.
     * @param startTi First body token index.
     * @param endTi Token count boundary.
     *
     * @returns True if at least one uBO modifier candidate was found.
     */
    private static hasUboCandidate(
        ctx: PreparserContext,
        startTi: number,
        endTi: number,
    ): boolean {
        const { types, ends, source } = ctx;

        for (let ti = startTi; ti < endTi - 2; ti += 1) {
            if (types[ti] !== TokenType.Colon) {
                continue;
            }

            const nextTi = ti + 1;
            if (types[nextTi] !== TokenType.Ident) {
                continue;
            }

            if (types[ti + 2] !== TokenType.OpenParen) {
                continue;
            }

            // Check if ident matches a known uBO modifier name
            const identStart = ends[ti]; // ident starts where colon ends
            const identEnd = ends[nextTi];

            if (
                regionEquals(source, identStart, identEnd, UboPseudoName.MatchesPath)
                || regionEquals(source, identStart, identEnd, UboPseudoName.MatchesMedia)
                || regionEquals(source, identStart, identEnd, UboPseudoName.Style)
                || regionEquals(source, identStart, identEnd, UboPseudoName.Remove)
            ) {
                return true;
            }

            // Also check for :not( wrapping :matches-path()
            if (regionEquals(source, identStart, identEnd, 'not')) {
                // Look ahead inside :not() for a uBO modifier candidate
                for (let j = ti + 3; j < endTi - 2; j += 1) {
                    if (types[j] === TokenType.Colon
                        && types[j + 1] === TokenType.Ident
                        && types[j + 2] === TokenType.OpenParen) {
                        const iStart = ends[j];
                        const iEnd = ends[j + 1];
                        if (regionEquals(source, iStart, iEnd, UboPseudoName.MatchesPath)) {
                            return true;
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
     * @param ctx Preparser context.
     * @param startTi First body token index.
     * @param endTi Token count boundary.
     *
     * @returns Number of uBO modifier records written to ctx.data.
     */
    private static scanUboModifiers(
        ctx: PreparserContext,
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
        let curModValueStart = 0;
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

                    // Value is between the opening paren and this closing paren
                    const valueEnd = tokenStart(ctx, ti);
                    if (curModValueStart < valueEnd) {
                        data[base + UBO_MOD_FIELD_VALUE_START] = curModValueStart;
                        data[base + UBO_MOD_FIELD_VALUE_END] = valueEnd;
                    } else {
                        data[base + UBO_MOD_FIELD_VALUE_START] = NO_VALUE;
                        data[base + UBO_MOD_FIELD_VALUE_END] = NO_VALUE;
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

            // Detect Colon + Ident + OpenParen pattern
            if (
                t === TokenType.Colon
                && ti + 2 < endTi
                && types[ti + 1] === TokenType.Ident
                && types[ti + 2] === TokenType.OpenParen
            ) {
                const identStart = ends[ti];
                const identEnd = ends[ti + 1];

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
                        if (modBit === UBO_MOD_BIT_MATCHES_PATH) {
                            // FR-004: :matches-path() can be inside :not() wrappers
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
                                    throw new Error(
                                        'Negated :matches-path() cannot be preceded by other tokens inside :not()',
                                    );
                                }

                                // Before OpenParen should be Ident "not"
                                if (j < 2 || types[j - 1] !== TokenType.Ident) {
                                    throw new Error(
                                        ':matches-path() can only be nested inside :not()',
                                    );
                                }

                                const wrapNameStart = ends[j - 2] !== undefined
                                    ? ends[j - 2]
                                    : tokenStart(ctx, j - 1);
                                const wrapNameEnd = ends[j - 1];

                                if (!regionEquals(source, wrapNameStart, wrapNameEnd, 'not')) {
                                    const fn = source.slice(wrapNameStart, wrapNameEnd);
                                    throw new Error(
                                        `:matches-path() can only be nested inside :not(), found :${fn}()`,
                                    );
                                }

                                // Before Ident should be Colon
                                if (j < 3 || types[j - 2] !== TokenType.Colon) {
                                    throw new Error(
                                        'Expected colon before :not() wrapping :matches-path()',
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
                                throw new Error(
                                    ':matches-path() cannot be nested inside another uBO modifier',
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
                            curModValueStart = ends[ti + 2]; // after OpenParen
                            curModOpen = true;

                            // Skip Ident and OpenParen tokens
                            ti += 2;
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
                        curModValueStart = ends[ti + 2]; // after OpenParen
                        curModOpen = true;

                        // Skip Ident and OpenParen tokens
                        ti += 2;
                        depth += 1;
                    }
                }
            }
        }

        return uboModCount;
    }
}
