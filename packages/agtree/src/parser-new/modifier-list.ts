/**
 * @file Modifier list parser — creates ModifierList AST nodes from preparsed data.
 *
 * Delegates individual modifier parsing to {@link ModifierParser}.
 */

import type { Modifier, ModifierList } from '../nodes';
import {
    NR_MODIFIER_COUNT,
    NR_HEADER_SIZE,
    MOD_STRIDE,
    MOD_NAME_START,
    MOD_VALUE_START,
    MOD_VALUE_END,
    MOD_NAME_END,
    NO_VALUE,
} from '../preparser/types';
import { ModifierParser } from './modifier';

/**
 * Parser for ModifierList AST nodes.
 *
 * Delegates individual modifier parsing to {@link ModifierParser}.
 */
export class ModifierListParser {
    /**
     * Builds a ModifierList AST node from preparsed data, or `undefined` if
     * there are no modifiers.
     *
     * @param source Original source string.
     * @param data Preparsed data buffer.
     * @param isLocIncluded Whether to include location info.
     * @returns ModifierList AST node, or `undefined`.
     */
    static parse(
        source: string,
        data: Int32Array,
        isLocIncluded: boolean,
    ): ModifierList | undefined {
        const modCount = data[NR_MODIFIER_COUNT];

        if (modCount === 0) {
            return undefined;
        }

        const children: Modifier[] = new Array(modCount);

        for (let i = 0; i < modCount; i += 1) {
            children[i] = ModifierParser.parse(source, data, i, isLocIncluded);
        }

        const modifiers: ModifierList = {
            type: 'ModifierList',
            children,
        };

        if (isLocIncluded && modCount > 0) {
            const firstBase = NR_HEADER_SIZE + MOD_NAME_START;
            const lastBase = NR_HEADER_SIZE + (modCount - 1) * MOD_STRIDE;
            const lastValStart = data[lastBase + MOD_VALUE_START];

            modifiers.start = data[firstBase];
            modifiers.end = lastValStart !== NO_VALUE
                ? data[lastBase + MOD_VALUE_END]
                : data[lastBase + MOD_NAME_END];
        }

        return modifiers;
    }
}
