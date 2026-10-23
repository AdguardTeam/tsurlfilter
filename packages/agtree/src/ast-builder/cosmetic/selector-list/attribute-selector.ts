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
import { DOUBLE_QUOTE } from '../../../utils/constants';
import { ValueAstBuilder } from '../../misc/value';

/**
 * Decodes the legacy AdGuard `""` double-quote escape in an attribute value.
 *
 * In the legacy AdGuard syntax, a double quote inside a double-quoted
 * attribute value is escaped by doubling it: `""` means one literal `"`.
 * The parser keeps the raw `""` text in the value range, so the escape is
 * decoded exactly once here, when the AST is built. The value offsets still
 * point to the original source range.
 *
 * Single-quoted values do not use this escape convention, so `""` in them
 * stays two literal double quotes.
 *
 * @param source Original source string.
 * @param valueStart Source offset of the first character of the value.
 * The offset excludes the surrounding quote characters, so
 * `source[valueStart - 1]` is the opening quote, if any.
 * @param value Value node built from the raw source range.
 *
 * @returns The value node with the decoded value, or the same node when the
 * value is not double-quoted.
 */
function decodeLegacyDoubleQuoteEscapes(source: string, valueStart: number, value: Value): Value {
    if (source[valueStart - 1] !== DOUBLE_QUOTE) {
        return value;
    }

    return {
        ...value,
        value: value.value.replace(/""/g, DOUBLE_QUOTE),
    };
}

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
 * unquoted content directly. In a double-quoted value, the legacy AdGuard
 * `""` escape is decoded to a single `"` (see
 * {@link decodeLegacyDoubleQuoteEscapes}); single-quoted values keep `""`
 * as two literal double quotes.
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

    const value = decodeLegacyDoubleQuoteEscapes(
        source,
        valueStart,
        ValueAstBuilder.parse(source, valueStart, valueEnd, isLocIncluded),
    );

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
