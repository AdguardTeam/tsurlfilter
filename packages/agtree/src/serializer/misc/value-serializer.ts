import { type Value } from '../../nodes/index.js';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer.js';
import { NULL } from '../../utils/constants.js';
import { isUndefined } from '../../utils/type-guards.js';
import { BaseSerializer } from '../base-serializer.js';
import { ValueNodeMarshallingMap } from '../../marshalling-utils/misc/value-common.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';

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
        buffer.writeUint8(BinaryTypeMarshallingMap.ValueNode);

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
