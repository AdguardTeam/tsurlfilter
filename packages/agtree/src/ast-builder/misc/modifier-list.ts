/**
 * @file Modifier list parser — creates ModifierList AST nodes from parsed data.
 *
 * Delegates individual modifier parsing to {@link ModifierAstBuilder}.
 */

import { NodeType } from '../../nodes';
import type { Modifier, ModifierList } from '../../nodes';
import {
    MODIFIER_FIELD_NAME_END,
    MODIFIER_FIELD_NAME_START,
    MODIFIER_FIELD_VALUE_END,
    MODIFIER_FIELD_VALUE_START,
    MODIFIER_RECORD_STRIDE,
    NO_VALUE,
    NR_MODIFIER_COUNT_OFFSET,
    NR_MODIFIER_RECORDS_OFFSET,
} from '../../parser/network/constants';

import { ModifierAstBuilder } from './modifier';

/**
 * Parser for ModifierList AST nodes.
 *
 * Delegates individual modifier parsing to {@link ModifierAstBuilder}.
 */
export class ModifierListAstBuilder {
    /**
     * Builds a ModifierList AST node from parsed data, or `undefined` if
     * there are no modifiers.
     *
     * @param source Original source string.
     * @param data Preparsed data buffer.
     * @param isLocIncluded Whether to include location info.
     * @param countOffset Buffer offset for modifier count (default: network rule offset).
     * @param recordsOffset Buffer offset where records begin (default: network rule offset).
     *
     * @returns ModifierList AST node, or `undefined`.
     */
    public static parse(
        source: string,
        data: Int32Array,
        isLocIncluded: boolean,
        countOffset: number = NR_MODIFIER_COUNT_OFFSET,
        recordsOffset: number = NR_MODIFIER_RECORDS_OFFSET,
    ): ModifierList | undefined {
        const modCount = data[countOffset];

        if (modCount === 0) {
            return undefined;
        }

        const children: Modifier[] = new Array(modCount);

        for (let i = 0; i < modCount; i += 1) {
            children[i] = ModifierAstBuilder.parse(source, data, i, isLocIncluded, recordsOffset);
        }

        const modifiers: ModifierList = {
            type: NodeType.ModifierList,
            children,
        };

        if (isLocIncluded && modCount > 0) {
            const firstBase = recordsOffset + MODIFIER_FIELD_NAME_START;
            const lastBase = recordsOffset + (modCount - 1) * MODIFIER_RECORD_STRIDE;
            const lastValStart = data[lastBase + MODIFIER_FIELD_VALUE_START];

            modifiers.start = data[firstBase];
            modifiers.end = lastValStart !== NO_VALUE
                ? data[lastBase + MODIFIER_FIELD_VALUE_END]
                : data[lastBase + MODIFIER_FIELD_NAME_END];
        }

        return modifiers;
    }
}
