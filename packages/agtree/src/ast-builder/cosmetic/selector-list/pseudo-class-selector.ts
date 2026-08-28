/**
 * @file Pseudo-class selector AST builder.
 *
 * Builds a PseudoClassSelector AST node from a parsed child record.
 */

import type { PseudoClassSelector } from '../../../nodes';
import { NodeType } from '../../../nodes';
import {
    CHILD_FIELD_0,
    CHILD_FIELD_1,
    CHILD_FIELD_2,
    CHILD_FIELD_3,
    CHILD_FIELD_SOURCE_END,
    CHILD_FIELD_SOURCE_START,
    NO_VALUE,
} from '../../../parser/css/selector-list/constants';
import { ValueAstBuilder } from '../../misc/value';

/**
 * Build a PseudoClassSelector AST node from a parsed child record.
 *
 * When `data[base + CHILD_FIELD_2] === NO_VALUE`, the pseudo-class is
 * non-functional (e.g. `:hover`) and no `argument` property is set.
 * Otherwise, `argument` is populated as a Value node — may be an empty
 * string for `:pseudo()` (where argStart === argEnd).
 *
 * @param source Original source string.
 * @param data Int32Array buffer with parsed data.
 * @param base Absolute base index of the child record in data.
 * @param isLocIncluded Whether to include start/end on the node.
 *
 * @returns PseudoClassSelector AST node.
 */
export function buildPseudoClassSelector(
    source: string,
    data: Int32Array,
    base: number,
    isLocIncluded: boolean,
): PseudoClassSelector {
    const nameStart = data[base + CHILD_FIELD_0];
    const nameEnd = data[base + CHILD_FIELD_1];
    const argStart = data[base + CHILD_FIELD_2];

    const node: PseudoClassSelector = {
        type: NodeType.PseudoClassSelector,
        name: ValueAstBuilder.parse(source, nameStart, nameEnd, isLocIncluded),
    };

    if (argStart !== NO_VALUE) {
        const argEnd = data[base + CHILD_FIELD_3];
        node.argument = ValueAstBuilder.parse(source, argStart, argEnd, isLocIncluded);
    }

    if (isLocIncluded) {
        node.start = data[base + CHILD_FIELD_SOURCE_START];
        node.end = data[base + CHILD_FIELD_SOURCE_END];
    }

    return node;
}
