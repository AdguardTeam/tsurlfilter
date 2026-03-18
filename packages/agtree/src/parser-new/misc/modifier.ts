/* eslint-disable no-bitwise */

/**
 * @file Modifier parser — creates Modifier AST nodes from preparsed data.
 *
 * Delegates value node creation to {@link ValueParser}.
 */

import type { Modifier } from '../../nodes';
import {
    MODIFIER_FIELD_FLAGS,
    MODIFIER_FIELD_NAME_END,
    MODIFIER_FIELD_NAME_START,
    MODIFIER_FIELD_VALUE_END,
    MODIFIER_FIELD_VALUE_START,
    MODIFIER_FLAG_NEGATED,
    MODIFIER_RECORD_STRIDE,
    NO_VALUE,
    NR_MODIFIER_RECORDS_OFFSET,
} from '../../preparser/network/network-rule';

import { ValueParser } from './value';

/**
 * Parser for Modifier AST nodes.
 *
 * Delegates value node creation to {@link ValueParser}.
 */
export class ModifierParser {
    /**
     * Builds a Modifier AST node from preparsed data at the given index.
     *
     * @param source Original source string.
     * @param data Preparsed data buffer.
     * @param idx Modifier index (0-based).
     * @param isLocIncluded Whether to include location info.
     *
     * @returns Modifier AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        idx: number,
        isLocIncluded: boolean,
    ): Modifier {
        const base = NR_MODIFIER_RECORDS_OFFSET + idx * MODIFIER_RECORD_STRIDE;

        const nameStart = data[base + MODIFIER_FIELD_NAME_START];
        const nameEnd = data[base + MODIFIER_FIELD_NAME_END];
        const modFlags = data[base + MODIFIER_FIELD_FLAGS];
        const valStart = data[base + MODIFIER_FIELD_VALUE_START];
        const valEnd = data[base + MODIFIER_FIELD_VALUE_END];

        const name = ValueParser.parse(source, nameStart, nameEnd, isLocIncluded);

        const modifier: Modifier = {
            type: 'Modifier',
            name,
            exception: (modFlags & MODIFIER_FLAG_NEGATED) !== 0,
        };

        if (valStart !== NO_VALUE) {
            modifier.value = ValueParser.parse(source, valStart, valEnd, isLocIncluded);
        }

        if (isLocIncluded) {
            modifier.start = nameStart;
            modifier.end = valStart !== NO_VALUE ? valEnd : nameEnd;
        }

        return modifier;
    }
}
