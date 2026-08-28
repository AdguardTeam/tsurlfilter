/**
 * @file Shared regex-literal detection helper for parser stages.
 *
 * Extracted here so both the modifier value parser and the network-rule
 * pattern parser share the same logic — a bug fix reaches both callers.
 */

import { TokenType } from '../../tokenizer/token-types';

/**
 * Returns `true` if the token range `[startTi, endTi)` represents a regex
 * literal of the form `/pattern/flags`.
 *
 * Detection rules:
 * 1. First token must be {@link TokenType.Slash}.
 * 2. After skipping any trailing {@link TokenType.Letter} tokens (regex flags),
 *    the last remaining token must also be a {@link TokenType.Slash} (closing
 *    delimiter).
 * 3. There must be **no** intermediate {@link TokenType.Slash} tokens between
 *    the opening and closing delimiters — a value like `/ads/banner/` is a
 *    path, not a regex.
 *
 * @param types Token-type array from the parser context (`ctx.types`).
 * @param startTi Start token index (inclusive).
 * @param endTi End token index (exclusive).
 *
 * @returns `true` if the range is a regex literal.
 */
export function isRegexLiteral(types: Uint8Array, startTi: number, endTi: number): boolean {
    if (startTi >= endTi || types[startTi] !== TokenType.Slash) {
        return false;
    }

    // Walk backward skipping trailing flag letters (g, i, m, s, u, y)
    let checkTi = endTi - 1;
    while (checkTi > startTi && types[checkTi] === TokenType.Letter) {
        checkTi -= 1;
    }

    // Closing delimiter must be a Slash strictly after the opening one
    if (types[checkTi] !== TokenType.Slash || checkTi <= startTi) {
        return false;
    }

    // Reject if there are intermediate slashes: /ads/banner/ is a path, not a regex
    for (let scanTi = startTi + 1; scanTi < checkTi; scanTi += 1) {
        if (types[scanTi] === TokenType.Slash) {
            return false;
        }
    }

    return true;
}
