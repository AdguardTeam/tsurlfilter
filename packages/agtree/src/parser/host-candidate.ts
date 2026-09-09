/**
 * @file Host-rule candidate check (parser layer).
 *
 * Owns the cheap token-stream gate so the structural parser can classify host
 * candidates without importing the AST-builder layer. The AST builder imports
 * this predicate instead, preserving the parser → AST dependency direction.
 */

import { TokenType } from '../tokenizer/token-types';

import type { ParserContext } from './context';

/**
 * Token-type lookup: `1` for token types that can legally appear in an
 * `/etc/hosts` line (letters, digits, `-`, `_`, non-ASCII, whitespace, line
 * breaks, `.`, `:`, and `#` for the trailing comment). Any other token type
 * (e.g. `|`, `^`, `$`, `/`, `@`, `*`) means the rule is definitely NOT a host
 * rule, so the candidate scan bails immediately. Indexed by `TokenType`.
 */
const HOST_LEGAL_TOKEN = ((): Uint8Array => {
    const table = new Uint8Array(64);
    for (const type of [
        TokenType.Letter,
        TokenType.Hyphen,
        TokenType.Digit,
        TokenType.Underscore,
        TokenType.NonAscii,
        TokenType.Eof,
        TokenType.Whitespace,
        TokenType.LineBreak,
        TokenType.HashMark,
        TokenType.Dot,
        TokenType.Colon,
    ]) {
        table[type] = 1;
    }
    return table;
})();

/**
 * Cheap O(1)-amortized gate deciding whether a network-classified rule could
 * be an `/etc/hosts`-style host rule, using the already-computed token stream.
 * A normal network rule contains an adblock-syntax token (`|`, `^`, `$`, `/`,
 * `@`, `*`, …) — usually at token 0 — so this early-exits without touching the
 * source string. Only genuine host candidates scan to the end.
 *
 * @param ctx Parser context whose tokenizer output is loaded.
 *
 * @returns True if the rule may be a host rule.
 */
export function isHostRuleCandidate(ctx: ParserContext): boolean {
    const { types, tokenCount } = ctx;

    for (let i = 0; i < tokenCount; i += 1) {
        const type = types[i];
        // The rest of the line is a `#comment` — host-legal; stop scanning.
        if (type === TokenType.HashMark) {
            break;
        }
        if (HOST_LEGAL_TOKEN[type] !== 1) {
            return false;
        }
    }

    return true;
}
