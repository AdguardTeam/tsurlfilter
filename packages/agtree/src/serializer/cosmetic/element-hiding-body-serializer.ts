import { BaseSerializer } from '../base-serializer';
import { BinaryTypeMap, type ElementHidingRuleBody } from '../../nodes';
import type { OutputByteBuffer } from '../../utils/output-byte-buffer';
import { ValueSerializer } from '../misc/value-serializer';
import { isUndefined } from '../../utils/type-guards';
import { NULL } from '../../utils/constants';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}
 *
 * @note Only 256 values can be represented this way.
 */
const enum ElementHidingRuleSerializationMap {
    SelectorList = 1,
    Start,
    End,
}

export class ElementHidingBodySerializer extends BaseSerializer {
    /**
     * Serializes an element hiding rule body node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: ElementHidingRuleBody, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.ElementHidingRuleBody);

        buffer.writeUint8(ElementHidingRuleSerializationMap.SelectorList);
        ValueSerializer.serialize(node.selectorList, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(ElementHidingRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(ElementHidingRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
