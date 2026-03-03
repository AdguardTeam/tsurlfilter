/**
 * @file Shared preparser heuristics.
 */

import { TokenType } from '../tokenizer/token-types';
import type { PreparserContext } from './context';

/**
 * Checks whether the token sequence at `offset` is a potential network modifier.
 * Pattern: `<space>? <tilde>? <space>? <ident> <space>? (<comma>|<equals>|end)`
 *
 * Ported from parser3/modifiers/utils.ts `isPotentialNetModifier`.
 * Uses explicit bounds checking because the typed array buffer is reused
 * and positions past `tokenCount` may contain stale data.
 *
 * @param ctx Preparser context.
 * @param offset Token index to start checking from.
 * @returns `true` if the sequence looks like a modifier start.
 */
export function isPotentialNetModifier(ctx: PreparserContext, offset: number): boolean {
    const { types, tokenCount } = ctx;

    let i = offset < tokenCount && types[offset] === TokenType.Whitespace
        ? offset + 1
        : offset;

    if (i < tokenCount && types[i] === TokenType.Tilde) {
        i += 1;
        if (i < tokenCount && types[i] === TokenType.Whitespace) {
            i += 1;
        }
    }

    if (i >= tokenCount || types[i] !== TokenType.Ident) {
        return false;
    }

    // Advance past ident
    i += 1;

    // Skip optional whitespace after ident
    if (i < tokenCount && types[i] === TokenType.Whitespace) {
        i += 1;
    }

    // End of tokens = valid modifier end
    if (i >= tokenCount) {
        return true;
    }

    return types[i] === TokenType.Comma || types[i] === TokenType.EqualsSign;
}
