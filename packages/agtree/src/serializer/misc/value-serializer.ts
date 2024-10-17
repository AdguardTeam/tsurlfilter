import { BinaryTypeMap, type Value } from '../../nodes';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { NULL } from '../../utils/constants';
import { isUndefined } from '../../utils/type-guards';
import { BaseSerializer } from '../base-serializer';
import { ValueNodeMarshallingMap } from '../../serialization-utils/misc/value-common';

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
            buffer.writeUint8(ValueNodeMarshallingMap.FrequentValue);
            buffer.writeUint8(frequentValue);
        } else {
            buffer.writeUint8(ValueNodeMarshallingMap.Value);
            buffer.writeString(node.value);
        }

        // note: do not use just `if (node.start)` because it can be 0
        if (!isUndefined(node.start)) {
            buffer.writeUint8(ValueNodeMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(ValueNodeMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
