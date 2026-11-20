/* eslint-disable no-param-reassign */

/**
 * @file Modifier list parser.
 *
 * Splits the modifier list by comma separators and delegates each
 * individual modifier to {@link ModifierParser}.
 */

import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { REGION_MODIFIERS } from '../../errors/capacity-overflow-error';
import { TokenType } from '../../tokenizer/token-types';
import type { ParserContext } from '../context';
import {
    CTX_STATUS_HARD_CAP,
    CTX_STATUS_OVERFLOW,
    growCtxRegion,
    tokenStart,
} from '../context';
import { MODIFIER_RECORD_STRIDE, NR_MODIFIER_COUNT_OFFSET, NR_MODIFIER_RECORDS_OFFSET } from '../network/constants';
import type { StructuralParser } from '../types';

import { ModifierParser } from './modifier';

/**
 * Parser for a comma-separated modifier list.
 *
 * Delegates individual modifier parsing to {@link ModifierParser}.
 */
export class ModifierListParser implements StructuralParser {
    /**
     * Minimum number of `ctx.data` slots for a modifier list with default capacity (64 modifiers).
     */
    public static readonly MIN_DATA_SLOTS = NR_MODIFIER_RECORDS_OFFSET + 64 * MODIFIER_RECORD_STRIDE;

    /**
     * Returns the number of modifiers in the parsed rule.
     *
     * @param data Preparsed data buffer.
     *
     * @returns Modifier count.
     */
    public static getCount(data: Int32Array): number {
        return data[NR_MODIFIER_COUNT_OFFSET];
    }

    /**
     * Searches for a modifier by name (zero allocation).
     *
     * @param source Original source string.
     * @param data Preparsed data buffer.
     * @param name Modifier name to search for.
     *
     * @returns Modifier index (0-based) or -1 if not found.
     */
    public static findIndex(source: string, data: Int32Array, name: string): number {
        const count = data[NR_MODIFIER_COUNT_OFFSET];

        for (let i = 0; i < count; i += 1) {
            if (ModifierParser.nameEquals(source, data, i, name)) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Returns `true` if the rule has a modifier with the given name (zero allocation).
     *
     * @param source Original source string.
     * @param data Preparsed data buffer.
     * @param name Modifier name to search for.
     *
     * @returns `true` if found.
     */
    public static hasNamed(source: string, data: Int32Array, name: string): boolean {
        return ModifierListParser.findIndex(source, data, name) !== -1;
    }

    /**
     * Preparse a comma-separated modifier list starting at token `startTi`.
     * Writes modifier records to `ctx.data` and returns the total count.
     *
     * @param ctx Parser context.
     * @param startTi Token index at the first modifier (after the `$` separator).
     * @param recordsOffset Buffer offset where modifier records should be written.
     * @param headerOffset Offset within `ctx.data` where the modifier-list
     *   header fields (count) are written.
     * @param endTi Exclusive token index where the modifier list ends. Defaults to `ctx.tokenCount`.
     */
    public static parse(
        ctx: ParserContext,
        startTi: number,
        recordsOffset: number,
        headerOffset: number,
        endTi: number = ctx.tokenCount,
    ): void {
        const { types } = ctx;
        const tokenCount = endTi;
        let { maxMods } = ctx;
        let currentTi = startTi;
        let modCount = 0;

        // `$` with nothing after it. 4.x rejects this, and accepting it turned
        // `||example.com^$` into a rule with an empty modifier list.
        if (currentTi >= tokenCount) {
            throw new AdblockSyntaxError(
                'Empty modifiers are not allowed',
                tokenStart(ctx, Math.max(0, tokenCount - 1)),
                ctx.ends[Math.max(0, tokenCount - 1)],
            );
        }

        while (currentTi < tokenCount) {
            // Grow if the buffer is full but there are still tokens to consume.
            if (modCount >= maxMods) {
                if (!ctx.grow) {
                    ctx.status = CTX_STATUS_OVERFLOW;
                    break;
                }
                const requested = Math.max(modCount + 1, maxMods * 2);
                if (!growCtxRegion(ctx, REGION_MODIFIERS, requested, headerOffset)) {
                    ctx.overflowRegion = REGION_MODIFIERS;
                    ctx.status = CTX_STATUS_HARD_CAP;
                    break;
                }
                maxMods = ctx.maxMods;
                // recordsOffset is passed as a parameter and equals NR_MODIFIER_RECORDS_OFFSET
                // (a fixed constant). Growing modifiers does NOT shift the modifier record start
                // offset, so recordsOffset remains valid.
            }

            const nextTi = ModifierParser.parse(ctx, currentTi, modCount, recordsOffset, tokenCount);

            // ModifierParser.parse returns -1 when no modifier name starts at
            // `currentTi`. Inside a modifier list that is an empty slot
            // (`$script,,domain=x.com`, `$script,`, `$~`, ...), which 4.x
            // rejects; silently stopping there used to drop every later
            // modifier, e.g. an unrestricted rule for `$script,,domain=x.com`.
            if (nextTi === -1) {
                const at = currentTi < tokenCount ? currentTi : Math.max(0, currentTi - 1);
                throw new AdblockSyntaxError(
                    'Modifier name cannot be empty',
                    tokenStart(ctx, at),
                    ctx.ends[at],
                );
            }

            modCount += 1;
            currentTi = nextTi;

            // Consume the separator comma (if present). A comma that ends the
            // list introduces an empty slot, which 4.x rejects.
            if (currentTi < tokenCount && types[currentTi] === TokenType.Comma) {
                currentTi += 1;
                if (currentTi >= tokenCount) {
                    throw new AdblockSyntaxError(
                        'Modifier name cannot be empty',
                        tokenStart(ctx, currentTi - 1),
                        ctx.ends[currentTi - 1],
                    );
                }
            }
        }

        ctx.data[headerOffset + NR_MODIFIER_COUNT_OFFSET] = modCount;
    }
}
