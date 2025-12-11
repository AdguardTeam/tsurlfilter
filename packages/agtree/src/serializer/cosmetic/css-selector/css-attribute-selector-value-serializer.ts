import {
    CssSelectorMarshallingMap,
    FREQUENT_CSS_ATTRIBUTE_OPERATORS_SERIALIZATION_MAP,
} from '../../../marshalling-utils/cosmetic/css-selector-common';
import { type CssAttributeSelectorValue } from '../../../nodes';
import { type OutputByteBuffer } from '../../../utils';
import { isUndefined } from '../../../utils/type-guards';
import { BaseSerializer } from '../../base-serializer';
import { ValueSerializer } from '../../misc/value-serializer';

/**
 * Serializer for CSS attribute selector value nodes.
 */
export class CssAttributeSelectorValueSerializer extends BaseSerializer {
    /**
     * Serializes a CSS attribute selector value node into a compact binary format.
     *
     * @param node The CssAttributeSelectorValue node to serialize.
     * @param buffer The OutputByteBuffer used for writing the binary data.
     */
    public static serialize(node: CssAttributeSelectorValue, buffer: OutputByteBuffer): void {
        // write header
        buffer.writeUint8(CssSelectorMarshallingMap.AttributeSelectorValueHeader);

        // write value
        buffer.writeUint8(CssSelectorMarshallingMap.AttributeSelectorValueValue);
        ValueSerializer.serialize(node.value, buffer);

        // write operator
        buffer.writeUint8(CssSelectorMarshallingMap.AttributeSelectorValueOperator);
        ValueSerializer.serialize(node.operator, buffer, FREQUENT_CSS_ATTRIBUTE_OPERATORS_SERIALIZATION_MAP);

        // write case sensitivity flag
        if (!isUndefined(node.isCaseSensitive)) {
            buffer.writeUint8(CssSelectorMarshallingMap.AttributeSelectorValueIsCaseSensitive);
            buffer.writeUint8(node.isCaseSensitive ? 1 : 0);
        }

        // write start position
        if (!isUndefined(node.start)) {
            buffer.writeUint8(CssSelectorMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        // write end position
        if (!isUndefined(node.end)) {
            buffer.writeUint8(CssSelectorMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        // write null terminator
        buffer.writeUint8(0);
    }
}
