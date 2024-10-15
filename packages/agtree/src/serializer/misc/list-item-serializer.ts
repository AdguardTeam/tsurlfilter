import { BaseSerializer } from '../base-serializer';
import { BinaryTypeMap, type ListItem, ListItemNodeType } from '../../nodes';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { NULL } from '../../utils/constants';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the binary schema version
 *
 * @note Only 256 values can be represented this way.
 */
const enum ListItemSerializationMap {
    Exception = 1,
    Value,
    Start,
    End,
}

export class ListItemSerializer extends BaseSerializer {
    /**
     * Serializes a list item to binary format.
     *
     * @param item List item to serialize.
     * @param buffer Output byte buffer.
     * @template T Type of the list item.
     */
    public static serialize<T extends ListItemNodeType>(item: ListItem<T>, buffer: OutputByteBuffer): void {
        switch (item.type) {
            case ListItemNodeType.App:
                buffer.writeUint8(BinaryTypeMap.AppNode);
                break;

            case ListItemNodeType.Domain:
                buffer.writeUint8(BinaryTypeMap.DomainNode);
                break;

            case ListItemNodeType.Method:
                buffer.writeUint8(BinaryTypeMap.MethodNode);
                break;

            case ListItemNodeType.StealthOption:
                buffer.writeUint8(BinaryTypeMap.StealthOptionNode);
                break;

            default:
                throw new Error(`Invalid list item type: ${item.type}`);
        }

        buffer.writeUint8(ListItemSerializationMap.Exception);
        buffer.writeUint8(item.exception ? 1 : 0);

        buffer.writeUint8(ListItemSerializationMap.Value);
        buffer.writeString(item.value);

        if (!isUndefined(item.start)) {
            buffer.writeUint8(ListItemSerializationMap.Start);
            buffer.writeUint32(item.start);
        }

        if (!isUndefined(item.end)) {
            buffer.writeUint8(ListItemSerializationMap.End);
            buffer.writeUint32(item.end);
        }

        buffer.writeUint8(NULL);
    }
}
