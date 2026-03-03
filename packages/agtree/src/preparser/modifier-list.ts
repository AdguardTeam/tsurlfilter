/* eslint-disable no-param-reassign */

/**
 * @file Modifier list preparser.
 *
 * Splits the modifier list by comma separators and delegates each
 * individual modifier to {@link ModifierPreparser}.
 */

import { TokenType } from '../tokenizer/token-types';
import type { PreparserContext } from './context';
import { ModifierPreparser } from './modifier';

/**
 * Preparser for a comma-separated modifier list.
 *
 * Delegates individual modifier parsing to {@link ModifierPreparser}.
 */
export class ModifierListPreparser {
    /**
     * Preparse a comma-separated modifier list starting at token `startTi`.
     * Writes modifier records to `ctx.data` and returns the total count.
     *
     * @param ctx Preparser context.
     * @param startTi Token index at the first modifier (after the `$` separator).
     * @returns Number of modifiers parsed.
     */
    public static preparse(ctx: PreparserContext, startTi: number): number {
        const { types, tokenCount, maxMods } = ctx;
        let mi = startTi;
        let modCount = 0;

        while (mi < tokenCount && modCount < maxMods) {
            const nextTi = ModifierPreparser.preparse(ctx, mi, modCount);

            // ModifierPreparser.preparse returns -1 if it can't start a modifier
            if (nextTi === -1) {
                break;
            }

            modCount += 1;
            mi = nextTi;

            // Consume the separator comma (if present)
            if (mi < tokenCount && types[mi] === TokenType.Comma) {
                mi += 1;
            }
        }

        // Overflow: more modifiers than buffer capacity
        if (mi < tokenCount && modCount >= maxMods) {
            ctx.status = 1;
        }

        return modCount;
    }
}
