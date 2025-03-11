// FIXME: Add common values
import { NULL } from '../../utils/constants';
import { type MethodList } from '../../nodes';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { BaseSerializer } from '../base-serializer';
import { ListItemsSerializer } from './list-items-serializer';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common';
import { MethodListMarshallingMap } from '../../marshalling-utils/misc/method-list-common';

/**
 * `MethodListSerializer` is responsible for serializing a method list.
 */
export class MethodListSerializer extends BaseSerializer {
    /**
     * Serializes a method list node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: MethodList, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMarshallingMap.MethodListNode);

        buffer.writeUint8(MethodListMarshallingMap.Children);
        ListItemsSerializer.serialize(node.children, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(MethodListMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(MethodListMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
