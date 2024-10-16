/* eslint-disable no-param-reassign */
import { BaseDeserializer } from '../base-deserializer';
import { BinaryTypeMap, type ListItem, ListItemNodeType } from '../../nodes';
import { NULL } from '../../utils/constants';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { ListItemSerializationMap } from '../../serialization-utils/misc/list-item-common';

export class ListItemDeserializer extends BaseDeserializer {
/**
 * Deserializes a list item from binary format.
 *
 * @param buffer Input byte buffer.
 * @param node Partial list item to deserialize.
 * @template T Type of the list item.
 */
    public static deserialize = <T extends ListItemNodeType>(
        buffer: InputByteBuffer,
        node: Partial<ListItem<T>>,
    ): void => {
        const type = buffer.readUint8();

        switch (type) {
            case BinaryTypeMap.AppNode:
                node.type = ListItemNodeType.App as T;
                break;

            case BinaryTypeMap.DomainNode:
                node.type = ListItemNodeType.Domain as T;
                break;

            case BinaryTypeMap.MethodNode:
                node.type = ListItemNodeType.Method as T;
                break;

            case BinaryTypeMap.StealthOptionNode:
                node.type = ListItemNodeType.StealthOption as T;
                break;

            default:
                throw new Error(`Invalid list item type: ${type}`);
        }

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ListItemSerializationMap.Exception:
                    node.exception = buffer.readUint8() === 1;
                    break;

                case ListItemSerializationMap.Value:
                    node.value = buffer.readString();
                    break;

                case ListItemSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ListItemSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${type}`);
            }

            prop = buffer.readUint8();
        }
    };
}
