/* eslint-disable no-param-reassign */

/**
 * @file Scriptlet body parser.
 *
 * Pre-computes parameter boundaries for ADG, UBO, and ABP scriptlet bodies.
 * All scanning uses token-type checks on the tokenizer output — zero heap
 * allocations. The output is written to ctx.data starting at a computed
 * offset after domain records.
 *
 * Data Layout (written at scriptletBodyDataOffset):
 *
 *   [+0]  snippetCallCount   (1 for ADG/UBO, N for ABP).
 *
 * Then for each call, written sequentially:
 *   [+0]  paramCount.
 *   [+1]  param0Start        (source offset, or -1 for null param).
 *   [+2]  param0End          (source offset, or -1 for null param).
 *   [+3]  param1Start.
 *   [+4]  param1End.
 */

import { sprintf } from 'sprintf-js';

import { AbpSnippetInjectionBodyCommon } from '../../common/abp-snippet-injection-body-common';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { REGION_SCRIPTLET_BODY } from '../../errors/capacity-overflow-error';
import { TokenType } from '../../tokenizer/token-types';
import {
    ADG_SCRIPTLET_MASK,
    CLOSE_PARENTHESIS,
    OPEN_PARENTHESIS,
    UBO_SCRIPTLET_MASK,
    UBO_SCRIPTLET_MASK_LEGACY,
} from '../../utils/constants';
import type { ParserContext } from '../context';
import {
    CTX_STATUS_HARD_CAP,
    CTX_STATUS_OVERFLOW,
    growCtxRegion,
    regionEquals,
    scriptletBodyDataOffset,
    skipWs,
    skipWsBack,
    tokenStart,
} from '../context';
import { NO_VALUE } from '../network/constants';
import type { CosmeticBodyParser } from '../types';

import {
    CR_BODY_END,
    CR_BODY_START,
    CR_BODY_START_TI,
    CR_FLAG_BODY_ADG_SCRIPTLET,
    CR_FLAG_BODY_UBO_SCRIPTLET,
    CR_FLAGS_OFFSET,
    CR_SEP_KIND_ABP_SNIPPET,
    CR_SEP_KIND_MASK,
    CR_SEP_KIND_SHIFT,
} from './constants';

// ---------------------------------------------------------------------------
// Error message constants (same as the AST parser used to emit)
// ---------------------------------------------------------------------------
const ADG_ERRORS = {
    NO_SCRIPTLET_MASK: `Invalid ADG scriptlet call, no scriptlet call mask '${ADG_SCRIPTLET_MASK}' found`,
    NO_OPENING_PARENTHESIS: `Invalid ADG scriptlet call, no opening parentheses '${OPEN_PARENTHESIS}' found`,
    NO_CLOSING_PARENTHESIS: `Invalid ADG scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
    WHITESPACE_AFTER_MASK: 'Invalid ADG scriptlet call, whitespace is not allowed after the scriptlet call mask',
    NO_INCONSISTENT_QUOTES: 'Invalid ADG scriptlet call, inconsistent quotes',
    NO_UNCLOSED_PARAMETER: 'Invalid ADG scriptlet call, unclosed parameter',
    EXPECTED_QUOTE: "Invalid ADG scriptlet call, expected quote, got '%s'",
    EXPECTED_COMMA: "Invalid ADG scriptlet call, expected comma, got '%s'",
};

const UBO_ERRORS = {
    NO_SCRIPTLET_MASK: `Invalid uBO scriptlet call, no scriptlet call mask '${UBO_SCRIPTLET_MASK}' found`,
    NO_OPENING_PARENTHESIS: `Invalid uBO scriptlet call, no opening parentheses '${OPEN_PARENTHESIS}' found`,
    NO_CLOSING_PARENTHESIS: `Invalid uBO scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
    NO_SCRIPTLET_NAME: 'Invalid uBO scriptlet call, no scriptlet name specified',
    WHITESPACE_AFTER_MASK: 'Invalid uBO scriptlet call, whitespace is not allowed after the scriptlet call mask',
};

// ---------------------------------------------------------------------------
// Scriptlet body parser
// ---------------------------------------------------------------------------

/**
 * Scriptlet body parser.
 *
 * Pre-computes parameter boundaries for ADG, UBO, and ABP scriptlet bodies
 * using token-type checks on the tokenizer output. Writes results to ctx.data
 * at the scriptlet body data offset (after domain records).
 */
export class ScriptletBodyParser implements CosmeticBodyParser {
    /**
     * Dispatches to the correct scriptlet flavor parser based on the
     * cosmetic flags already written into `ctx.data` by the rule
     * dispatcher. The dispatcher MUST set one of:
     *
     *   - `CR_FLAG_BODY_ADG_SCRIPTLET`
     *   - `CR_FLAG_BODY_UBO_SCRIPTLET`
     *   - `CR_SEP_KIND_ABP_SNIPPET` packed into the sep-kind bits.
     *
     * Before invoking this method. Body bounds are read from `ctx.data`..
     *
     * @param ctx Parser context.
     * @param _classified Packed classifier result. Currently unused; kept
     *   for {@link CosmeticBodyParser} contract conformance.
     * @param endTi Exclusive token index where the rule ends. Defaults to `ctx.tokenCount`.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-bitwise
    public static parse(ctx: ParserContext, _classified: number, endTi = ctx.tokenCount): void {
        const flags = ctx.data[CR_FLAGS_OFFSET];
        // eslint-disable-next-line no-bitwise
        const sepKind = (flags >>> CR_SEP_KIND_SHIFT) & CR_SEP_KIND_MASK;
        const bodyStartTi = ctx.data[CR_BODY_START_TI];
        const bodyStart = ctx.data[CR_BODY_START];
        const bodyEnd = ctx.data[CR_BODY_END];
        const bodyEndTi = endTi;

        // eslint-disable-next-line no-bitwise
        if ((flags & CR_FLAG_BODY_ADG_SCRIPTLET) !== 0) {
            ScriptletBodyParser.parseAdg(ctx, bodyStartTi, bodyEndTi, bodyStart, bodyEnd);
            return;
        }
        // eslint-disable-next-line no-bitwise
        if ((flags & CR_FLAG_BODY_UBO_SCRIPTLET) !== 0) {
            ScriptletBodyParser.parseUbo(ctx, bodyStartTi, bodyEndTi, bodyStart, bodyEnd);
            return;
        }
        if (sepKind === CR_SEP_KIND_ABP_SNIPPET) {
            ScriptletBodyParser.parseAbp(ctx, bodyStartTi, bodyEndTi, bodyStart, bodyEnd);
            return;
        }
        throw new AdblockSyntaxError(
            'ScriptletBodyParser.parse: no scriptlet flavor flag set on ctx.data[CR_FLAGS_OFFSET]',
            bodyStart,
            bodyEnd,
        );
    }

    /**
     * Preparse an ADG scriptlet body: `//scriptlet('name', 'arg0', ...)`.
     *
     * @param ctx Parser context (source + data).
     * @param bodyStartTi Token index where body starts.
     * @param bodyEndTi Token index where body ends (exclusive).
     * @param bodyStart Source offset where body starts.
     * @param bodyEnd Source offset where body ends.
     */
    private static parseAdg(
        ctx: ParserContext,
        bodyStartTi: number,
        bodyEndTi: number,
        bodyStart: number,
        bodyEnd: number,
    ): void {
        const { source, types, ends } = ctx;
        let { data } = ctx;
        const base = scriptletBodyDataOffset(ctx);
        let limit = base + ctx.maxScriptletBody;
        let di = base;

        // Skip leading whitespace tokens
        let ti = skipWs(ctx, bodyStartTi, bodyEndTi);

        // Validate //scriptlet mask
        const maskStart = tokenStart(ctx, ti);
        if (!regionEquals(source, maskStart, maskStart + ADG_SCRIPTLET_MASK.length, ADG_SCRIPTLET_MASK)) {
            throw new AdblockSyntaxError(ADG_ERRORS.NO_SCRIPTLET_MASK, maskStart, bodyEnd);
        }

        // Advance past the mask tokens
        const maskEnd = maskStart + ADG_SCRIPTLET_MASK.length;
        while (ti < bodyEndTi && ends[ti] <= maskEnd) {
            ti += 1;
        }

        // No whitespace after mask
        if (ti < bodyEndTi && types[ti] === TokenType.Whitespace) {
            throw new AdblockSyntaxError(ADG_ERRORS.WHITESPACE_AFTER_MASK, tokenStart(ctx, ti), bodyEnd);
        }

        // Opening paren
        if (ti >= bodyEndTi || types[ti] !== TokenType.OpenParen) {
            throw new AdblockSyntaxError(
                ADG_ERRORS.NO_OPENING_PARENTHESIS,
                ti < bodyEndTi ? tokenStart(ctx, ti) : bodyEnd,
                bodyEnd,
            );
        }
        const openParenTi = ti;
        ti += 1;

        // Find closing paren — scan backward from end, skip trailing whitespace
        const closeParenTi = skipWsBack(ctx, bodyEndTi - 1, openParenTi + 1);
        if (types[closeParenTi] !== TokenType.CloseParen) {
            throw new AdblockSyntaxError(
                ADG_ERRORS.NO_CLOSING_PARENTHESIS,
                tokenStart(ctx, openParenTi),
                bodyEnd,
            );
        }
        // Check not escaped
        if (closeParenTi > 0 && types[closeParenTi - 1] === TokenType.Escaped) {
            throw new AdblockSyntaxError(
                ADG_ERRORS.NO_CLOSING_PARENTHESIS,
                tokenStart(ctx, openParenTi),
                bodyEnd,
            );
        }

        // Write snippetCallCount = 1
        data[di] = 1;
        di += 1;

        // Check for empty call — skip whitespace inside parens
        const innerTi = skipWs(ctx, ti, closeParenTi);
        if (innerTi === closeParenTi) {
            data[di] = 0; // paramCount = 0
            return;
        }

        // Reserve slot for paramCount, fill it later
        const paramCountSlot = di;
        di += 1;
        let paramCount = 0;
        let detectedQuoteType = 0; // 0 = none, else TokenType.Apostrophe or TokenType.Quote

        ti = innerTi;

        while (ti < closeParenTi) {
            // Skip whitespace
            ti = skipWs(ctx, ti, closeParenTi);

            // Expect comma before non-first param
            if (paramCount > 0) {
                if (types[ti] !== TokenType.Comma) {
                    throw new AdblockSyntaxError(
                        sprintf(ADG_ERRORS.EXPECTED_COMMA, source[tokenStart(ctx, ti)]),
                        tokenStart(ctx, ti),
                        bodyEnd,
                    );
                }
                ti += 1; // eat comma
                // Skip whitespace after comma
                ti = skipWs(ctx, ti, closeParenTi);
            }

            const tt = types[ti];
            if (tt === TokenType.Apostrophe || tt === TokenType.Quote) {
                // Enforce consistent quoting
                if (detectedQuoteType === 0) {
                    detectedQuoteType = tt;
                } else if (detectedQuoteType !== tt) {
                    throw new AdblockSyntaxError(ADG_ERRORS.NO_INCONSISTENT_QUOTES, tokenStart(ctx, ti), bodyEnd);
                }

                const quoteStart = tokenStart(ctx, ti);
                ti += 1; // past opening quote

                // Find closing quote (same type), skip escaped tokens
                let closeQuoteTi = -1;
                let scanTi = ti;
                while (scanTi < bodyEndTi) {
                    if (types[scanTi] === TokenType.Escaped) {
                        scanTi += 1;
                        continue;
                    }
                    if (types[scanTi] === tt) {
                        closeQuoteTi = scanTi;
                        break;
                    }
                    scanTi += 1;
                }

                if (closeQuoteTi === -1) {
                    throw new AdblockSyntaxError(ADG_ERRORS.NO_UNCLOSED_PARAMETER, quoteStart, bodyEnd);
                }

                // Write param boundary (including quotes)
                if (di + 1 >= limit) {
                    if (!ctx.grow) {
                        data[paramCountSlot] = paramCount;
                        ctx.status = CTX_STATUS_OVERFLOW;
                        return;
                    }
                    const relativeSlot = di - base;
                    const requested = Math.max(ctx.maxScriptletBody * 2, relativeSlot + 4);
                    if (!growCtxRegion(ctx, REGION_SCRIPTLET_BODY, requested)) {
                        data[paramCountSlot] = paramCount;
                        ctx.overflowRegion = REGION_SCRIPTLET_BODY;
                        ctx.status = CTX_STATUS_HARD_CAP;
                        return;
                    }
                    // base is unchanged; only limit and data need updating.
                    data = ctx.data;
                    limit = base + ctx.maxScriptletBody;
                    di = base + relativeSlot;
                }
                data[di] = quoteStart;
                data[di + 1] = ends[closeQuoteTi];
                di += 2;
                paramCount += 1;

                ti = closeQuoteTi + 1;

                // Skip whitespace after closing quote
                ti = skipWs(ctx, ti, closeParenTi);
            } else {
                throw new AdblockSyntaxError(
                    sprintf(ADG_ERRORS.EXPECTED_QUOTE, source[tokenStart(ctx, ti)]),
                    tokenStart(ctx, ti),
                    bodyEnd,
                );
            }
        }

        data[paramCountSlot] = paramCount;
    }

    /**
     * Preparse a UBO scriptlet body: `+js(name, arg0, ...)` or
     * `script:inject(name, arg0, ...)`.
     *
     * @param ctx Parser context.
     * @param bodyStartTi Token index where body starts.
     * @param bodyEndTi Token index where body ends (exclusive).
     * @param bodyStart Source offset where body starts.
     * @param bodyEnd Source offset where body ends.
     */
    private static parseUbo(
        ctx: ParserContext,
        bodyStartTi: number,
        bodyEndTi: number,
        bodyStart: number,
        bodyEnd: number,
    ): void {
        const { source, types, ends } = ctx;
        let { data } = ctx;
        const base = scriptletBodyDataOffset(ctx);
        let di = base;

        // Skip leading whitespace tokens
        let ti = skipWs(ctx, bodyStartTi, bodyEndTi);

        // Detect mask (+js or script:inject)
        const maskStart = tokenStart(ctx, ti);
        let maskLen = 0;
        if (regionEquals(source, maskStart, maskStart + UBO_SCRIPTLET_MASK.length, UBO_SCRIPTLET_MASK)) {
            maskLen = UBO_SCRIPTLET_MASK.length;
        } else if (regionEquals(
            source,
            maskStart,
            maskStart + UBO_SCRIPTLET_MASK_LEGACY.length,
            UBO_SCRIPTLET_MASK_LEGACY,
        )) {
            maskLen = UBO_SCRIPTLET_MASK_LEGACY.length;
        }
        if (maskLen === 0) {
            throw new AdblockSyntaxError(UBO_ERRORS.NO_SCRIPTLET_MASK, maskStart, bodyEnd);
        }

        // Advance past the mask tokens
        const maskEnd = maskStart + maskLen;
        while (ti < bodyEndTi && ends[ti] <= maskEnd) {
            ti += 1;
        }

        // No whitespace after mask
        if (ti < bodyEndTi && types[ti] === TokenType.Whitespace) {
            throw new AdblockSyntaxError(UBO_ERRORS.WHITESPACE_AFTER_MASK, tokenStart(ctx, ti), bodyEnd);
        }

        // Opening paren
        if (ti >= bodyEndTi || types[ti] !== TokenType.OpenParen) {
            throw new AdblockSyntaxError(
                UBO_ERRORS.NO_OPENING_PARENTHESIS,
                ti < bodyEndTi ? tokenStart(ctx, ti) : bodyEnd,
                bodyEnd,
            );
        }
        const openParenTi = ti;
        ti += 1;

        // Find closing paren — scan backward from end, skip trailing whitespace
        const closeParenTi = skipWsBack(ctx, bodyEndTi - 1, openParenTi + 1);
        if (types[closeParenTi] !== TokenType.CloseParen) {
            throw new AdblockSyntaxError(
                UBO_ERRORS.NO_CLOSING_PARENTHESIS,
                tokenStart(ctx, openParenTi),
                bodyEnd,
            );
        }
        // Check not escaped
        if (closeParenTi > 0 && types[closeParenTi - 1] === TokenType.Escaped) {
            throw new AdblockSyntaxError(
                UBO_ERRORS.NO_CLOSING_PARENTHESIS,
                tokenStart(ctx, openParenTi),
                bodyEnd,
            );
        }

        // Write snippetCallCount = 1
        data[di] = 1;
        di += 1;

        // Empty call check — skip whitespace inside parens
        const innerTi = skipWs(ctx, ti, closeParenTi);
        if (innerTi === closeParenTi) {
            data[di] = 0;
            return;
        }

        // Parse UBO parameter list inside parens using token indices
        di = ScriptletBodyParser.parseUboParamListTokens(ctx, base, di, innerTi, closeParenTi);

        // Validate first param is not null (scriptlet name required)
        data = ctx.data;
        const pc = data[base + 1];
        if (pc > 0 && data[base + 2] === NO_VALUE) {
            throw new AdblockSyntaxError(UBO_ERRORS.NO_SCRIPTLET_NAME, tokenStart(ctx, openParenTi), bodyEnd);
        }
    }

    /**
     * Preparse a UBO-style comma-separated parameter list using token indices.
     *
     * @param ctx Parser context.
     * @param base Base offset of the scriptlet data region in `data`.
     * @param di Current write offset in data.
     * @param startTi First token index inside parens (after leading ws).
     * @param endTi Token index of closing paren (exclusive boundary).
     *
     * @returns Updated data write offset.
     */
    private static parseUboParamListTokens(
        ctx: ParserContext,
        base: number,
        di: number,
        startTi: number,
        endTi: number,
    ): number {
        const { types, ends } = ctx;
        let { data } = ctx;
        let limit = base + ctx.maxScriptletBody;
        const paramCountSlot = di;
        di += 1;
        let paramCount = 0;
        let ti = startTi;
        let extraNull = false;

        while (ti < endTi) {
            // Skip leading whitespace
            ti = skipWs(ctx, ti, endTi);
            if (ti >= endTi) {
                break;
            }

            const paramStartOffset = tokenStart(ctx, ti);
            let paramEndOffset = paramStartOffset;
            const tt = types[ti];

            if (tt === TokenType.Apostrophe || tt === TokenType.Quote || tt === TokenType.Backtick) {
                // Quoted parameter — find matching close quote
                const quoteType = tt;
                const quoteTi = ti;
                ti += 1;
                let closeQuoteTi = -1;

                while (ti < endTi) {
                    if (types[ti] === TokenType.Escaped) {
                        ti += 1;
                        continue;
                    }
                    if (types[ti] === quoteType) {
                        closeQuoteTi = ti;
                        break;
                    }
                    ti += 1;
                }

                if (closeQuoteTi >= 0) {
                    // Found closing quote — check what follows
                    const afterTi = skipWs(ctx, closeQuoteTi + 1, endTi);

                    if (afterTi >= endTi || types[afterTi] === TokenType.Comma) {
                        paramEndOffset = ends[closeQuoteTi];
                        ti = afterTi;
                        if (ti < endTi && types[ti] === TokenType.Comma) {
                            ti += 1; // eat comma
                            // Trailing comma → extra null
                            if (skipWs(ctx, ti, endTi) >= endTi) {
                                extraNull = true;
                            }
                        }
                    } else {
                        // Quote is not a proper delimiter — search for comma from opening quote
                        let commaTi = quoteTi;
                        while (commaTi < endTi && types[commaTi] !== TokenType.Comma) {
                            commaTi += 1;
                        }
                        if (commaTi < endTi) {
                            // Trim trailing whitespace before comma
                            const trimTi = skipWsBack(ctx, commaTi - 1, quoteTi + 1);
                            paramEndOffset = ends[trimTi];
                            ti = commaTi + 1;
                        } else {
                            // No comma found — param extends to end
                            const trimTi = skipWsBack(ctx, endTi - 1, quoteTi + 1);
                            paramEndOffset = ends[trimTi];
                            ti = endTi;
                        }
                    }
                } else {
                    // No closing quote — param extends to end
                    const trimTi = skipWsBack(ctx, endTi - 1, quoteTi + 1);
                    paramEndOffset = ends[trimTi];
                    ti = endTi;
                }
            } else {
                // Unquoted parameter — find next unescaped comma
                let commaTi = ti;
                while (commaTi < endTi) {
                    if (types[commaTi] === TokenType.Escaped) {
                        commaTi += 1;
                        continue;
                    }
                    if (types[commaTi] === TokenType.Comma) {
                        break;
                    }
                    commaTi += 1;
                }

                if (commaTi < endTi) {
                    // Trim trailing whitespace before comma
                    const trimTi = skipWsBack(ctx, commaTi - 1, ti + 1);
                    paramEndOffset = trimTi >= ti ? ends[trimTi] : paramStartOffset;
                    ti = commaTi + 1;

                    // Trailing comma → extra null
                    if (skipWs(ctx, ti, endTi) >= endTi) {
                        extraNull = true;
                    }
                } else {
                    // No comma — param extends to trimmed end
                    const trimTi = skipWsBack(ctx, endTi - 1, ti + 1);
                    paramEndOffset = trimTi >= ti ? ends[trimTi] : paramStartOffset;
                    ti = endTi;
                }
            }

            if (di + 1 >= limit) {
                // Overflow inside parseUboParamListTokens: grow or bail.
                data[paramCountSlot] = paramCount;
                if (!ctx.grow) {
                    ctx.status = CTX_STATUS_OVERFLOW;
                    return di;
                }
                const relativeSlot = di - base;
                const requested = Math.max(ctx.maxScriptletBody * 2, relativeSlot + 4);
                if (!growCtxRegion(ctx, REGION_SCRIPTLET_BODY, requested)) {
                    ctx.overflowRegion = REGION_SCRIPTLET_BODY;
                    ctx.status = CTX_STATUS_HARD_CAP;
                    return di;
                }
                data = ctx.data;
                limit = base + ctx.maxScriptletBody;
                di = base + relativeSlot;
            }
            if (paramStartOffset < paramEndOffset) {
                data[di] = paramStartOffset;
                data[di + 1] = paramEndOffset;
            } else {
                data[di] = NO_VALUE;
                data[di + 1] = NO_VALUE;
            }
            di += 2;
            paramCount += 1;
        }

        if (extraNull) {
            if (di + 1 >= limit) {
                // Overflow on trailing null: grow or bail.
                data[paramCountSlot] = paramCount;
                if (!ctx.grow) {
                    ctx.status = CTX_STATUS_OVERFLOW;
                    return di;
                }
                const relativeSlot = di - base;
                const requested = Math.max(ctx.maxScriptletBody * 2, relativeSlot + 4);
                if (!growCtxRegion(ctx, REGION_SCRIPTLET_BODY, requested)) {
                    ctx.overflowRegion = REGION_SCRIPTLET_BODY;
                    ctx.status = CTX_STATUS_HARD_CAP;
                    return di;
                }
                data = ctx.data;
                limit = base + ctx.maxScriptletBody;
                di = base + relativeSlot;
            }
            data[di] = NO_VALUE;
            data[di + 1] = NO_VALUE;
            di += 2;
            paramCount += 1;
        }

        data[paramCountSlot] = paramCount;
        return di;
    }

    /**
     * Preparse an ABP snippet body: `snippet0 arg0; snippet1 arg1`.
     *
     * @param ctx Parser context.
     * @param bodyStartTi Token index where body starts.
     * @param bodyEndTi Token index where body ends (exclusive).
     * @param bodyStart Source offset where body starts.
     * @param bodyEnd Source offset where body ends.
     */
    private static parseAbp(
        ctx: ParserContext,
        bodyStartTi: number,
        bodyEndTi: number,
        bodyStart: number,
        bodyEnd: number,
    ): void {
        let { data } = ctx;
        const base = scriptletBodyDataOffset(ctx);

        const callCountSlot = base;
        let di = base + 1;
        let callCount = 0;

        // Skip leading whitespace
        let ti = skipWs(ctx, bodyStartTi, bodyEndTi);

        while (ti < bodyEndTi) {
            // Skip whitespace between calls
            ti = skipWs(ctx, ti, bodyEndTi);
            if (ti >= bodyEndTi) {
                break;
            }

            const callStartTi = ti;

            // Find next unescaped semicolon outside strings/regexes
            const semiTi = ScriptletBodyParser.findUnescapedSemicolonOutsideStrings(ctx, ti, bodyEndTi);
            const callEndTi = semiTi === -1 ? bodyEndTi : semiTi;

            // Trim trailing whitespace from call
            const trimmedCallEndTi = skipWsBack(ctx, callEndTi - 1, callStartTi) + 1;

            // Parse space-separated params for this call
            di = ScriptletBodyParser.parseAbpParamListTokens(
                ctx,
                base,
                di,
                callStartTi,
                trimmedCallEndTi,
            );
            // Refresh data reference in case growth occurred inside parseAbpParamListTokens.
            data = ctx.data;
            callCount += 1;

            ti = semiTi === -1 ? bodyEndTi : semiTi + 1;
        }

        if (callCount === 0) {
            throw new AdblockSyntaxError(
                AbpSnippetInjectionBodyCommon.ERROR_MESSAGES.EMPTY_SCRIPTLET_CALL,
                bodyStart,
                bodyEnd,
            );
        }

        data[callCountSlot] = callCount;
    }

    /**
     * Find next unescaped semicolon that is not inside a string or regex
     * literal, using token types.
     *
     * @param ctx Parser context.
     * @param startTi Start token index.
     * @param endTi End token index (exclusive).
     *
     * @returns Token index of the semicolon, or -1 if not found.
     */
    private static findUnescapedSemicolonOutsideStrings(
        ctx: ParserContext,
        startTi: number,
        endTi: number,
    ): number {
        const { types } = ctx;
        let ti = startTi;

        while (ti < endTi) {
            const tt = types[ti];

            if (tt === TokenType.Escaped) {
                ti += 1;
                continue;
            }

            if (tt === TokenType.Semicolon) {
                return ti;
            }

            // String literal — skip to closing quote
            if (tt === TokenType.Apostrophe || tt === TokenType.Quote || tt === TokenType.Backtick) {
                const quoteType = tt;
                ti += 1;
                while (ti < endTi) {
                    if (types[ti] === TokenType.Escaped) {
                        ti += 1;
                        continue;
                    }
                    if (types[ti] === quoteType) {
                        break;
                    }
                    ti += 1;
                }
                ti += 1; // past closing quote
                continue;
            }

            // Regex literal (slash-delimited)
            if (tt === TokenType.Slash) {
                ti += 1;
                while (ti < endTi) {
                    if (types[ti] === TokenType.Escaped) {
                        ti += 1;
                        continue;
                    }
                    if (types[ti] === TokenType.Slash) {
                        break;
                    }
                    ti += 1;
                }
                ti += 1; // past closing slash
                continue;
            }

            ti += 1;
        }

        return -1;
    }

    /**
     * Preparse an ABP-style space-separated parameter list using token indices.
     *
     * @param ctx Parser context.
     * @param base Base offset of the scriptlet data region in `data`.
     * @param di Current write offset in data.
     * @param startTi Start token index.
     * @param endTi End token index (exclusive, after trimming).
     *
     * @returns Updated data write offset.
     */
    private static parseAbpParamListTokens(
        ctx: ParserContext,
        base: number,
        di: number,
        startTi: number,
        endTi: number,
    ): number {
        const { types, ends } = ctx;
        let { data } = ctx;
        let limit = base + ctx.maxScriptletBody;
        const paramCountSlot = di;
        di += 1;
        let paramCount = 0;
        let ti = startTi;

        while (ti < endTi) {
            // Skip whitespace
            ti = skipWs(ctx, ti, endTi);
            if (ti >= endTi) {
                break;
            }

            const paramStartTi = ti;
            const paramStartOffset = tokenStart(ctx, ti);

            // Find next unescaped space outside strings
            const sepTi = ScriptletBodyParser.findUnescapedSpaceOutsideStrings(ctx, ti, endTi);
            const paramEndTi = sepTi === -1 ? endTi : sepTi;

            // Trim trailing whitespace from param
            const trimEndTi = skipWsBack(ctx, paramEndTi - 1, paramStartTi);

            const paramEndOffset = trimEndTi >= paramStartTi ? ends[trimEndTi] : paramStartOffset;

            if (di + 1 >= limit) {
                // Overflow inside parseAbpParamListTokens: grow or bail.
                data[paramCountSlot] = paramCount;
                if (!ctx.grow) {
                    ctx.status = CTX_STATUS_OVERFLOW;
                    return di;
                }
                const relativeSlot = di - base;
                const requested = Math.max(ctx.maxScriptletBody * 2, relativeSlot + 4);
                if (!growCtxRegion(ctx, REGION_SCRIPTLET_BODY, requested)) {
                    ctx.overflowRegion = REGION_SCRIPTLET_BODY;
                    ctx.status = CTX_STATUS_HARD_CAP;
                    return di;
                }
                data = ctx.data;
                limit = base + ctx.maxScriptletBody;
                di = base + relativeSlot;
            }
            if (paramStartOffset < paramEndOffset) {
                data[di] = paramStartOffset;
                data[di + 1] = paramEndOffset;
            } else {
                data[di] = NO_VALUE;
                data[di + 1] = NO_VALUE;
            }
            di += 2;
            paramCount += 1;

            ti = sepTi === -1 ? endTi : sepTi + 1;
        }

        // Trailing space → extra null
        if (endTi > startTi && types[endTi - 1] === TokenType.Whitespace) {
            if (di + 1 >= limit) {
                // Overflow on trailing null: grow or bail.
                data[paramCountSlot] = paramCount;
                if (!ctx.grow) {
                    ctx.status = CTX_STATUS_OVERFLOW;
                    return di;
                }
                const relativeSlot = di - base;
                const requested = Math.max(ctx.maxScriptletBody * 2, relativeSlot + 4);
                if (!growCtxRegion(ctx, REGION_SCRIPTLET_BODY, requested)) {
                    ctx.overflowRegion = REGION_SCRIPTLET_BODY;
                    ctx.status = CTX_STATUS_HARD_CAP;
                    return di;
                }
                data = ctx.data;
                limit = base + ctx.maxScriptletBody;
                di = base + relativeSlot;
            }
            data[di] = NO_VALUE;
            data[di + 1] = NO_VALUE;
            di += 2;
            paramCount += 1;
        }

        data[paramCountSlot] = paramCount;
        return di;
    }

    /**
     * Find next unescaped whitespace token that is not inside a string or
     * regex literal, using token types.
     *
     * @param ctx Parser context.
     * @param startTi Start token index.
     * @param endTi End token index (exclusive).
     *
     * @returns Token index of the whitespace token, or -1 if not found.
     */
    private static findUnescapedSpaceOutsideStrings(
        ctx: ParserContext,
        startTi: number,
        endTi: number,
    ): number {
        const { types } = ctx;
        let ti = startTi;

        while (ti < endTi) {
            const tt = types[ti];

            if (tt === TokenType.Escaped) {
                ti += 1;
                continue;
            }

            if (tt === TokenType.Whitespace) {
                return ti;
            }

            if (tt === TokenType.Apostrophe || tt === TokenType.Quote || tt === TokenType.Backtick) {
                const quoteType = tt;
                ti += 1;
                while (ti < endTi) {
                    if (types[ti] === TokenType.Escaped) {
                        ti += 1;
                        continue;
                    }
                    if (types[ti] === quoteType) {
                        break;
                    }
                    ti += 1;
                }
                ti += 1;
                continue;
            }

            if (tt === TokenType.Slash) {
                ti += 1;
                while (ti < endTi) {
                    if (types[ti] === TokenType.Escaped) {
                        ti += 1;
                        continue;
                    }
                    if (types[ti] === TokenType.Slash) {
                        break;
                    }
                    ti += 1;
                }
                ti += 1;
                continue;
            }

            ti += 1;
        }

        return -1;
    }
}
