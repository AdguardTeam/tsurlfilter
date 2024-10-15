import { BinaryTypeMap, type Value } from '../../nodes';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { NULL } from '../../utils/constants';
import { isUndefined } from '../../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';
import { BaseSerializer } from '../base-serializer';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum ValueNodeSerializationMap {
    Value = 1,
    FrequentValue,
    Start,
    End,
}

/**
 * Value serializer.
 */
export class ValueSerializer extends BaseSerializer {
    /**
     * Serializes a value node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     * @param frequentValuesMap Optional map of frequent values.
     * @param toLower Whether to lowercase the value before the frequent value match (defaults to `false`).
     */
    public static serialize(
        node: Value,
        buffer: OutputByteBuffer,
        frequentValuesMap?: Map<string, number>,
        toLower = false,
    ): void {
        buffer.writeUint8(BinaryTypeMap.ValueNode);

        const frequentValue = frequentValuesMap?.get(toLower ? node.value.toLowerCase() : node.value);
        // note: do not use just `if (frequentValue)` because it can be 0
        if (!isUndefined(frequentValue)) {
            buffer.writeUint8(ValueNodeSerializationMap.FrequentValue);
            buffer.writeUint8(frequentValue);
        } else {
            buffer.writeUint8(ValueNodeSerializationMap.Value);
            buffer.writeString(node.value);
        }

        // note: do not use just `if (node.start)` because it can be 0
        if (!isUndefined(node.start)) {
            buffer.writeUint8(ValueNodeSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(ValueNodeSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
