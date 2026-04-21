/* eslint-disable no-param-reassign */

/**
 * @file Modifier list parser.
 *
 * Splits the modifier list by comma separators and delegates each
 * individual modifier to {@link ModifierParser}.
 */

import { TokenType } from '../../tokenizer/token-types';
import type { ParserContext } from '../context';
import { NR_MODIFIER_COUNT_OFFSET } from '../network/constants';

import { ModifierParser } from './modifier';

/**
 * Parser for a comma-separated modifier list.
 *
 * Delegates individual modifier parsing to {@link ModifierParser}.
 */
export class ModifierListParser {
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
     * @param recordsOffset Buffer offset where modifier records should be written (defaults to network offset).
     * @param dataOffset Offset within ctx.data where header fields are written (defaults to 0).
     */
    public static parse(ctx: ParserContext, startTi: number, recordsOffset?: number, dataOffset = 0): void {
        const { types, tokenCount, maxMods } = ctx;
        let currentTi = startTi;
        let modCount = 0;

        while (currentTi < tokenCount && modCount < maxMods) {
            const nextTi = ModifierParser.parse(ctx, currentTi, modCount, recordsOffset);

            // ModifierParser.parse returns -1 if it can't start a modifier
            if (nextTi === -1) {
                break;
            }

            modCount += 1;
            currentTi = nextTi;

            // Consume the separator comma (if present)
            if (currentTi < tokenCount && types[currentTi] === TokenType.Comma) {
                currentTi += 1;
            }
        }

        // Overflow: more modifiers than buffer capacity
        if (currentTi < tokenCount && modCount >= maxMods) {
            ctx.status = 1;
        }

        ctx.data[dataOffset + NR_MODIFIER_COUNT_OFFSET] = modCount;
    }
}
