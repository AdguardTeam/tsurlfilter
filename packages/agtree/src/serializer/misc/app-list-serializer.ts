import { NULL } from '../../utils/constants';
import { type AppList } from '../../nodes';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { BaseSerializer } from '../base-serializer';
import { ListItemsSerializer } from './list-items-serializer';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common';
import { AppListMarshallingMap } from '../../marshalling-utils/misc/app-list-common';

/**
 * `AppListSerializer` is responsible for serializing an app list.
 */
export class AppListSerializer extends BaseSerializer {
    /**
     * Serializes an app list node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: AppList, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMarshallingMap.AppListNode);

        buffer.writeUint8(AppListMarshallingMap.Children);
        ListItemsSerializer.serialize(node.children, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(AppListMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(AppListMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
