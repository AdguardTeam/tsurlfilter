import { BaseSerializer } from '../base-serializer';
import { BinaryTypeMap, type HostnameList } from '../../nodes';
import type { OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { NULL, UINT16_MAX } from '../../utils/constants';
import { ValueSerializer } from '../misc/value-serializer';
import { HostnameListNodeMarshallingMap } from '../../serialization-utils/misc/hostname-list-common';

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
            buffer.writeUint8(HostnameListNodeMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(HostnameListNodeMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        const count = node.children.length;
        if (count) {
            // note: we store the count, because re-construction of the array is faster if we know the length
            if (count > UINT16_MAX) {
                throw new Error(`Too many children: ${count}, the limit is ${UINT16_MAX}`);
            }

            buffer.writeUint8(HostnameListNodeMarshallingMap.Children);
            buffer.writeUint16(count);

            for (let i = 0; i < count; i += 1) {
                ValueSerializer.serialize(node.children[i], buffer);
            }
        }

        buffer.writeUint8(NULL);
    }
}
