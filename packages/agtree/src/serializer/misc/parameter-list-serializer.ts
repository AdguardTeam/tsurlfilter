import { type ParameterList } from '../../nodes/index.js';
import { NULL } from '../../utils/constants.js';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer.js';
import { ValueSerializer } from './value-serializer.js';
import { isNull, isUndefined } from '../../utils/type-guards.js';
import { BaseSerializer } from '../base-serializer.js';
import { ParameterListNodeMarshallingMap } from '../../marshalling-utils/misc/parameter-list-common.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';

/**
 * Serializer for parameter list nodes.
 */
export class ParameterListSerializer extends BaseSerializer {
    /**
     * Serializes a parameter list node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     * @param frequentValuesMap Optional map of frequent values.
     * @param toLower Whether to lowercase the value before the frequent value match (defaults to `false`).
     */
    public static serialize(
        node: ParameterList,
        buffer: OutputByteBuffer,
        frequentValuesMap?: Map<string, number>,
        toLower = false,
    ): void {
        buffer.writeUint8(BinaryTypeMarshallingMap.ParameterListNode);

        const count = node.children.length;
        buffer.writeUint8(ParameterListNodeMarshallingMap.Children);
        // note: we store the count, because re-construction of the array is faster if we know the length
        buffer.writeUint32(count);

        for (let i = 0; i < count; i += 1) {
            const child = node.children[i];
            if (isNull(child)) {
                buffer.writeUint8(BinaryTypeMarshallingMap.Null);
                continue;
            }
            ValueSerializer.serialize(child, buffer, frequentValuesMap, toLower);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(ParameterListNodeMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(ParameterListNodeMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
