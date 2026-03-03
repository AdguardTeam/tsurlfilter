/* eslint-disable no-bitwise */

/**
 * @file Modifier parser — creates Modifier AST nodes from preparsed data.
 *
 * Delegates value node creation to {@link ValueParser}.
 */

import type { Modifier } from '../nodes';
import {
    NR_HEADER_SIZE,
    MOD_STRIDE,
    MOD_NAME_START,
    MOD_NAME_END,
    MOD_FLAGS,
    MOD_VALUE_START,
    MOD_VALUE_END,
    MOD_FLAG_NEGATED,
    NO_VALUE,
} from '../preparser/types';
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
     * @returns Modifier AST node.
     */
    static parse(
        source: string,
        data: Int32Array,
        idx: number,
        isLocIncluded: boolean,
    ): Modifier {
        const base = NR_HEADER_SIZE + idx * MOD_STRIDE;

        const nameStart = data[base + MOD_NAME_START];
        const nameEnd = data[base + MOD_NAME_END];
        const modFlags = data[base + MOD_FLAGS];
        const valStart = data[base + MOD_VALUE_START];
        const valEnd = data[base + MOD_VALUE_END];

        const name = ValueParser.parse(source, nameStart, nameEnd, isLocIncluded);

        const result: Modifier = {
            type: 'Modifier',
            name,
            exception: (modFlags & MOD_FLAG_NEGATED) !== 0,
        };

        if (valStart !== NO_VALUE) {
            result.value = ValueParser.parse(source, valStart, valEnd, isLocIncluded);
        }

        if (isLocIncluded) {
            result.start = nameStart;
            result.end = valStart !== NO_VALUE ? valEnd : nameEnd;
        }

        return result;
    }
}
