/**
 * @file Class selector AST builder.
 *
 * Builds a ClassSelector AST node from a parsed child record.
 */

import type { ClassSelector } from '../../../nodes';
import { NodeType } from '../../../nodes';
import {
    CHILD_FIELD_0,
    CHILD_FIELD_1,
    CHILD_FIELD_SOURCE_END,
    CHILD_FIELD_SOURCE_START,
} from '../../../parser/css/selector-list/constants';

/**
 * Build a ClassSelector AST node from a parsed child record.
 *
 * The value excludes the leading '.' character — the parser stores offsets
 * past the dot in CHILD_FIELD_0.
 *
 * @param source Original source string.
 * @param data Int32Array buffer with parsed data.
 * @param base Absolute base index of the child record in data.
 * @param isLocIncluded Whether to include start/end on the node.
 *
 * @returns ClassSelector AST node.
 */
export function buildClassSelector(
    source: string,
    data: Int32Array,
    base: number,
    isLocIncluded: boolean,
): ClassSelector {
    const node: ClassSelector = {
        type: NodeType.ClassSelector,
        value: source.slice(data[base + CHILD_FIELD_0], data[base + CHILD_FIELD_1]),
    };

    if (isLocIncluded) {
        node.start = data[base + CHILD_FIELD_SOURCE_START];
        node.end = data[base + CHILD_FIELD_SOURCE_END];
    }

    return node;
}
