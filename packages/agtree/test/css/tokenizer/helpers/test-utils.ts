/**
 * @file Test utilities for CSS token mapping tests.
 *
 * Provides a `tokenizeSource` helper that tokenizes a source string with the
 * adblock tokenizer and returns the buffers needed by the mapping functions.
 */

import { Tokenizer } from '../../../../src/tokenizer/tokenizer';

/**
 * Result of tokenizing a source string for use in CSS mapping tests.
 */
export interface TokenizeResult {
    types: Uint8Array;
    ends: Uint32Array;
    source: string;
    tokenCount: number;
    initialOffset: number;
}

/**
 * Tokenize a source string and return the buffers needed for CSS mapping
 * function testing.
 *
 * @param source Source string to tokenize.
 * @param initialOffset Optional start offset (default 0).
 *
 * @returns Tokenizer output bundled for convenient use.
 */
export function tokenizeSource(source: string, initialOffset: number = 0): TokenizeResult {
    const t = new Tokenizer(source.length + 1);
    t.source = source;
    t.offset = initialOffset;
    t.tokenize();
    return {
        types: t.types,
        ends: t.ends,
        source,
        tokenCount: t.tokenCount,
        initialOffset,
    };
}
