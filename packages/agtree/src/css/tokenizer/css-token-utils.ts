/**
 * @file CSS-level token classification utilities.
 *
 * Lightweight predicates and helpers that interpret agtree's sub-CSS token
 * types in terms of CSS grammar concepts (ident-start, ident-code-point,
 * ident run, whitespace). These avoid a full CSS token abstraction layer —
 * they're just convenient wrappers around range checks on
 * {@link TokenType} values.
 */

import { IDENT_START_MASK, TokenType } from '../../tokenizer/token-types';

/**
 * Whether `type` is a CSS `<ident-start-code-point>` token: `Letter` or
 * `Underscore`.
 *
 * Uses the {@link IDENT_START_MASK} bitmask for a branchless check.
 *
 * @param type Token type value.
 *
 * @returns `true` if the token can start a CSS `<ident-token>`.
 */
export function isCssIdentStart(type: number): boolean {
    // Guard against types ≥ 32 since JS bitwise ops work modulo 32
    // eslint-disable-next-line no-bitwise
    return type < 32 && ((IDENT_START_MASK >>> type) & 1) !== 0;
}

/**
 * Whether `type` is a CSS `<ident-code-point>` token: `Letter`, `Hyphen`,
 * `Digit`, `Underscore`, or `NonAscii`.
 *
 * Leverages the deliberate ordering of token types 0–4.
 *
 * @param type Token type value.
 *
 * @returns `true` if the token is one of the five ident-part primitives.
 */
export function isCssIdentPart(type: number): boolean {
    return type <= TokenType.NonAscii;
}

/**
 * Whether `type` can appear inside a CSS identifier run as recognized by the
 * preparser: any {@link isCssIdentPart ident-part} token or `Escaped`.
 *
 * @param type Token type value.
 *
 * @returns `true` if the token should be consumed as part of an ident run.
 */
export function isCssIdentRun(type: number): boolean {
    return type <= TokenType.NonAscii || type === TokenType.Escaped;
}

/**
 * Advance past a CSS identifier run in a token types array.
 *
 * Consumes consecutive tokens where {@link isCssIdentRun} is `true`
 * (`Letter`, `Hyphen`, `Digit`, `Underscore`, `NonAscii`, or `Escaped`).
 *
 * @param types Token types buffer.
 * @param ti Start token index.
 * @param tokenCount Total number of tokens in `types`.
 *
 * @returns The index of the first token **after** the run (may equal `ti` if
 * no ident-run token was found at the start position).
 */
export function consumeCssIdentRun(types: Uint8Array, ti: number, tokenCount: number): number {
    let i = ti;
    while (i < tokenCount && (types[i] <= TokenType.NonAscii || types[i] === TokenType.Escaped)) {
        i += 1;
    }
    return i;
}

/**
 * Whether `type` is a CSS whitespace token: `Whitespace` or `LineBreak`.
 *
 * @param type Token type value.
 *
 * @returns `true` if the token represents whitespace in CSS terms.
 */
export function isCssWhitespace(type: number): boolean {
    return type === TokenType.Whitespace || type === TokenType.LineBreak;
}
