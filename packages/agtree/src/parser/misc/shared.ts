/**
 * @file Shared parser heuristics.
 */

import { TokenType } from '../../tokenizer/token-types';
import type { ParserContext } from '../context';

/**
 * Checks whether the token sequence at `offset` is a potential network modifier.
 * Pattern: `<space>? <tilde>? <space>? <ident> <space>? (<comma>|<equals>|end)`.
 *
 * Ported from parser3/modifiers/utils.ts `isPotentialNetModifier`.
 * Uses explicit bounds checking because the typed array buffer is reused
 * and positions past `tokenCount` may contain stale data.
 *
 * @param ctx Parser context.
 * @param offset Token index to start checking from.
 * @param endTi Exclusive token index marking the end of the current rule.
 * Bounds must be scoped to the current rule (not the whole chunk), otherwise
 * tokens belonging to a following rule — e.g. the line break after `$3p` in
 * `||a^$3p\n||b^$script` — would be mistaken for the modifier's terminator and
 * cause the `$` separator to be rejected. Defaults to `ctx.tokenCount`.
 *
 * @returns `true` if the sequence looks like a modifier start.
 */
export function isPotentialNetModifier(ctx: ParserContext, offset: number, endTi: number = ctx.tokenCount): boolean {
    const { types } = ctx;

    let i = offset < endTi && types[offset] === TokenType.Whitespace
        ? offset + 1
        : offset;

    if (i < endTi && types[i] === TokenType.Tilde) {
        i += 1;
        if (i < endTi && types[i] === TokenType.Whitespace) {
            i += 1;
        }
    }

    if (i >= endTi || (types[i] !== TokenType.Letter && types[i] !== TokenType.Digit)) {
        return false;
    }

    // Advance past modifier name — Letter (0) | Hyphen (1) | Digit (2): types <= TokenType.Digit
    while (i < endTi && types[i] <= TokenType.Digit) {
        i += 1;
    }

    // Skip optional whitespace after ident
    if (i < endTi && types[i] === TokenType.Whitespace) {
        i += 1;
    }

    // End of rule tokens = valid modifier end
    if (i >= endTi) {
        return true;
    }

    return types[i] === TokenType.Comma || types[i] === TokenType.EqualsSign;
}
