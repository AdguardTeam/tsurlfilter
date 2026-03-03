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
import { NR_HEADER_SIZE, MOD_STRIDE } from './types';

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
 * @param tokenCapacity - Maximum number of tokens (default 1024).
 * @param modifierCapacity - Maximum number of modifiers (default 64).
 * @returns A new PreparserContext ready for use.
 */
export function createPreparserContext(
    tokenCapacity = 1024,
    modifierCapacity = 64,
): PreparserContext {
    return {
        source: '',
        sourceStart: 0,
        types: new Uint8Array(tokenCapacity),
        ends: new Uint32Array(tokenCapacity),
        tokenCount: 0,
        data: new Int32Array(NR_HEADER_SIZE + modifierCapacity * MOD_STRIDE),
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
