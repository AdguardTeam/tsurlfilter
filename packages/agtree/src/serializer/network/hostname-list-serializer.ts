import { BaseSerializer } from '../base-serializer.js';
import { type HostnameList } from '../../nodes/index.js';
import type { OutputByteBuffer } from '../../utils/output-byte-buffer.js';
import { isUndefined } from '../../utils/type-guards.js';
import { NULL, UINT16_MAX } from '../../utils/constants.js';
import { ValueSerializer } from '../misc/value-serializer.js';
import { HostnameListNodeMarshallingMap } from '../../marshalling-utils/misc/hostname-list-common.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';

/**
 * Serializer for hostname list nodes.
 */
export class HostnameListSerializer extends BaseSerializer {
    /**
     * Serializes a hostname list node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: HostnameList, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMarshallingMap.HostnameListNode);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(HostnameListNodeMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(HostnameListNodeMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        const count = node.children.length;
        // If there are no children, we do not write any data related to them, to avoid using unnecessary storage,
        // but children is a required field, so during deserialization we should initialize it as an empty array,
        // if there are no children in the binary data.
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
