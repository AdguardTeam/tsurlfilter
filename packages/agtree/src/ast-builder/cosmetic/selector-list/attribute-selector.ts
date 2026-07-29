/**
 * @file Attribute selector AST builder.
 *
 * Builds an AttributeSelector AST node from a parsed child record.
 * Produces either an AttributeSelectorWithoutValue (name only) or
 * AttributeSelectorWithValue (name + operator + value + optional flag).
 */

import type {
    AttributeSelector,
    AttributeSelectorFlagValue,
    AttributeSelectorOperatorValue,
    AttributeSelectorWithoutValue,
    AttributeSelectorWithValue,
    Value,
} from '../../../nodes';
import { NodeType } from '../../../nodes';
import {
    CHILD_FIELD_0,
    CHILD_FIELD_1,
    CHILD_FIELD_2,
    CHILD_FIELD_3,
    CHILD_FIELD_4,
    CHILD_FIELD_5,
    CHILD_FIELD_6,
    CHILD_FIELD_7,
    CHILD_FIELD_SOURCE_END,
    CHILD_FIELD_SOURCE_START,
    NO_VALUE,
} from '../../../parser/css/selector-list/constants';
import { ValueAstBuilder } from '../../misc/value';

/**
 * Build an AttributeSelector AST node from a parsed child record.
 *
 * When `data[base + CHILD_FIELD_2] === NO_VALUE` (no operator), produces an
 * `AttributeSelectorWithoutValue` (name only). Otherwise, produces an
 * `AttributeSelectorWithValue` with name, operator, value, and — when
 * `data[base + CHILD_FIELD_6] !== NO_VALUE` — an optional flag sub-node.
 *
 * For quoted attribute values the parser stores offsets that already
 * exclude the surrounding quote characters, so `source.slice()` yields the
 * unquoted content directly.
 *
 * @param source Original source string.
 * @param data Int32Array buffer with parsed data.
 * @param base Absolute base index of the child record in data.
 * @param isLocIncluded Whether to include start/end on the node.
 *
 * @returns AttributeSelector AST node.
 */
export function buildAttributeSelector(
    source: string,
    data: Int32Array,
    base: number,
    isLocIncluded: boolean,
): AttributeSelector {
    const srcStart = data[base + CHILD_FIELD_SOURCE_START];
    const srcEnd = data[base + CHILD_FIELD_SOURCE_END];

    const nameStart = data[base + CHILD_FIELD_0];
    const nameEnd = data[base + CHILD_FIELD_1];
    const name = ValueAstBuilder.parse(source, nameStart, nameEnd, isLocIncluded);

    // No operator → attribute presence selector: [attr]
    if (data[base + CHILD_FIELD_2] === NO_VALUE) {
        const node: AttributeSelectorWithoutValue = {
            type: NodeType.AttributeSelector,
            name,
        };

        if (isLocIncluded) {
            node.start = srcStart;
            node.end = srcEnd;
        }

        return node;
    }

    // Has operator → attribute value selector: [attr=val] / [attr~="val" i]
    const operatorStart = data[base + CHILD_FIELD_2];
    const operatorEnd = data[base + CHILD_FIELD_3];
    const valueStart = data[base + CHILD_FIELD_4];
    const valueEnd = data[base + CHILD_FIELD_5];
    const flagStart = data[base + CHILD_FIELD_6];

    const operator = ValueAstBuilder.parse(
        source,
        operatorStart,
        operatorEnd,
        isLocIncluded,
    ) as Value<AttributeSelectorOperatorValue>;

    const value = ValueAstBuilder.parse(source, valueStart, valueEnd, isLocIncluded);

    const node: AttributeSelectorWithValue = {
        type: NodeType.AttributeSelector,
        name,
        operator,
        value,
    };

    if (flagStart !== NO_VALUE) {
        const flagEnd = data[base + CHILD_FIELD_7];
        node.flag = ValueAstBuilder.parse(
            source,
            flagStart,
            flagEnd,
            isLocIncluded,
        ) as Value<AttributeSelectorFlagValue>;
    }

    if (isLocIncluded) {
        node.start = srcStart;
        node.end = srcEnd;
    }

    return node;
}
