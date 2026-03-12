/* eslint-disable no-param-reassign */

/**
 * @file Preparser context — shared state passed through the parser chain.
 *
 * All preparsers (network-rule → modifier-list → modifier → value) operate
 * on the same context. This avoids parameter threading and keeps the
 * chaining ergonomic while staying allocation-free.
 */

import { TokenType } from '../tokenizer/token-types';
import type { TokenizeResult } from '../tokenizer/tokenizer';
import { NR_HEADER_SIZE, MOD_STRIDE } from './network/constants';

/**
 * Default maximum number of tokens per rule.
 * Shared default across network and comment rules.
 */
const DEFAULT_TOKEN_CAPACITY = 1024;

/**
 * Default maximum number of modifiers per network rule.
 * Most network rules have 1-5 modifiers; 64 provides headroom.
 */
const DEFAULT_MODIFIER_CAPACITY = 64;

// Minimum ctx.data slots needed to embed the LE node tree for !#if directives:
//   CM_PREP_LE_OFFSET(5) + LE_BUFFER_SIZE(LE_HEADER(2) + LE_MAX_NODES(32) * LE_STRIDE(5)) = 167
const CM_PREP_MIN_DATA_SLOTS = 167;

/**
 * Shared preparser context.
 *
 * Holds references to tokenizer output buffers, the source string,
 * and the output Int32Array. All preparsers read tokens and write
 * structural indices through this single object.
 */
export interface PreparserContext {
    /**
     * Original source string.
     */
    source: string;

    /**
     * Source offset for the first token (usually 0).
     */
    sourceStart: number;

    /**
     * Token types buffer (from tokenizer).
     */
    types: Uint8Array;

    /**
     * Token end positions buffer (from tokenizer).
     */
    ends: Uint32Array;

    /**
     * Number of valid tokens in the buffer.
     */
    tokenCount: number;

    /**
     * Output data buffer (Int32Array with structural indices).
     */
    data: Int32Array;

    /**
     * Maximum number of modifiers the buffer can hold.
     */
    maxMods: number;

    /**
     * Parse status: 0 = success, 1 = overflow.
     */
    status: 0 | 1;
}

/**
 * Creates a pre-allocated PreparserContext.
 *
 * @param tokenCapacity - Maximum number of tokens.
 * @param modifierCapacity - Maximum number of modifiers.
 * @returns A new PreparserContext ready for use.
 */
export function createPreparserContext(
    tokenCapacity = DEFAULT_TOKEN_CAPACITY,
    modifierCapacity = DEFAULT_MODIFIER_CAPACITY,
): PreparserContext {
    return {
        source: '',
        sourceStart: 0,
        types: new Uint8Array(tokenCapacity),
        ends: new Uint32Array(tokenCapacity),
        tokenCount: 0,
        data: new Int32Array(Math.max(NR_HEADER_SIZE + modifierCapacity * MOD_STRIDE, CM_PREP_MIN_DATA_SLOTS)),
        maxMods: modifierCapacity,
        status: 0,
    };
}

/**
 * Initialize the context from tokenizer output for a new parse.
 *
 * @param ctx - Context to initialize.
 * @param source - Source string.
 * @param tokens - Tokenizer output.
 * @param sourceStart - Source offset (default 0).
 */
export function initPreparserContext(
    ctx: PreparserContext,
    source: string,
    tokens: TokenizeResult,
    sourceStart = 0,
): void {
    ctx.source = source;
    ctx.sourceStart = sourceStart;
    ctx.types = tokens.types;
    ctx.ends = tokens.ends;
    ctx.tokenCount = tokens.tokenCount;
    ctx.status = 0;
}

/**
 * Returns the source-string start index of a token.
 * Token `i` starts where token `i-1` ended. Token 0 starts at `sourceStart`.
 *
 * @param ctx - Preparser context.
 * @param ti - Token index.
 * @returns Source start index of the token.
 */
export function tokenStart(ctx: PreparserContext, ti: number): number {
    return ti === 0 ? ctx.sourceStart : ctx.ends[ti - 1];
}

/**
 * Skip a single whitespace token if present.
 * The tokenizer groups consecutive whitespace into one token,
 * so skipping one Whitespace token is sufficient.
 *
 * @param ctx - Preparser context.
 * @param ti - Current token index.
 * @returns Token index after optional whitespace.
 */
export function skipWs(ctx: PreparserContext, ti: number): number {
    return ti < ctx.tokenCount && ctx.types[ti] === TokenType.Whitespace ? ti + 1 : ti;
}

/**
 * Returns the index of the last token in `[startTi, endTi)` that is not Whitespace.
 * Returns `-1` if there are no non-whitespace tokens in the range.
 *
 * @param ctx - Preparser context.
 * @param startTi - Start of range (inclusive).
 * @param endTi - End of range (exclusive).
 * @returns Index of last non-whitespace token, or `-1`.
 */
export function lastNonWs(ctx: PreparserContext, startTi: number, endTi: number): number {
    let ti = endTi - 1;
    while (ti >= startTi && ctx.types[ti] === TokenType.Whitespace) {
        ti -= 1;
    }
    return ti >= startTi ? ti : -1;
}

/**
 * Advance to the next occurrence of `tokenType`, or to `end`.
 *
 * @param ctx - Preparser context.
 * @param ti - Current token index.
 * @param end - Token count boundary.
 * @param tokenType - Token type to stop at.
 * @returns Token index at the found token or `end`.
 */
export function skipUntil(ctx: PreparserContext, ti: number, end: number, tokenType: number): number {
    const { types } = ctx;
    while (ti < end && types[ti] !== tokenType) {
        ti += 1;
    }
    return ti;
}

/**
 * Returns `true` when the source substring `[start, end)` equals `target`,
 * without allocating a slice.
 *
 * @param source Source string.
 * @param start  Start index (inclusive).
 * @param end    End index (exclusive).
 * @param target String to compare against.
 * @returns Whether the region exactly equals `target`.
 */
export function regionEquals(source: string, start: number, end: number, target: string): boolean {
    const len = end - start;

    if (len !== target.length) {
        return false;
    }

    for (let i = 0; i < len; i += 1) {
        if (source.charCodeAt(start + i) !== target.charCodeAt(i)) {
            return false;
        }
    }

    return true;
}
