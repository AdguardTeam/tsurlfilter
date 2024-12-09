import { BaseSerializer } from '../base-serializer';
import { type ListItem, ListItemNodeType, type ListItemNodeTypeType } from '../../nodes';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { NULL } from '../../utils/constants';
import { ListItemMarshallingMap } from '../../marshalling-utils/misc/list-item-common';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common';

/**
 * Serializer for list item nodes.
 */
export class ListItemSerializer extends BaseSerializer {
    /**
     * Serializes a list item to binary format.
     *
     * @param item List item to serialize.
     * @param buffer Output byte buffer.
     * @template T Type of the list item.
     */
    public static serialize<T extends ListItemNodeTypeType>(item: ListItem<T>, buffer: OutputByteBuffer): void {
        switch (item.type) {
            case ListItemNodeType.App:
                buffer.writeUint8(BinaryTypeMarshallingMap.AppNode);
                break;

            case ListItemNodeType.Domain:
                buffer.writeUint8(BinaryTypeMarshallingMap.DomainNode);
                break;

            case ListItemNodeType.Method:
                buffer.writeUint8(BinaryTypeMarshallingMap.MethodNode);
                break;

            case ListItemNodeType.StealthOption:
                buffer.writeUint8(BinaryTypeMarshallingMap.StealthOptionNode);
                break;

            default:
                throw new Error(`Invalid list item type: ${item.type}`);
        }

        buffer.writeUint8(ListItemMarshallingMap.Exception);
        buffer.writeUint8(item.exception ? 1 : 0);

        buffer.writeUint8(ListItemMarshallingMap.Value);
        buffer.writeString(item.value);

        if (!isUndefined(item.start)) {
            buffer.writeUint8(ListItemMarshallingMap.Start);
            buffer.writeUint32(item.start);
        }

        if (!isUndefined(item.end)) {
            buffer.writeUint8(ListItemMarshallingMap.End);
            buffer.writeUint32(item.end);
        }

        buffer.writeUint8(NULL);
    }
}
