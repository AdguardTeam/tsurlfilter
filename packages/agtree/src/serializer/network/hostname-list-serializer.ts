import { BaseSerializer } from '../base-serializer';
import { BinaryTypeMap, type HostnameList } from '../../nodes';
import type { OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { NULL, UINT16_MAX } from '../../utils/constants';
import { ValueSerializer } from '../misc/value-serializer';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the `BINARY_SCHEMA_VERSION`
 *
 * @note Only 256 values can be represented this way.
 */
const enum HostnameListNodeSerializationMap {
    Children = 1,
    Start,
    End,
}

export class HostnameListSerializer extends BaseSerializer {
    /**
     * Serializes a hostname list node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: HostnameList, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.HostnameListNode);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(HostnameListNodeSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(HostnameListNodeSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        const count = node.children.length;
        if (count) {
            // note: we store the count, because re-construction of the array is faster if we know the length
            if (count > UINT16_MAX) {
                throw new Error(`Too many children: ${count}, the limit is ${UINT16_MAX}`);
            }

            buffer.writeUint8(HostnameListNodeSerializationMap.Children);
            buffer.writeUint16(count);

            for (let i = 0; i < count; i += 1) {
                ValueSerializer.serialize(node.children[i], buffer);
            }
        }

        buffer.writeUint8(NULL);
    }
}
