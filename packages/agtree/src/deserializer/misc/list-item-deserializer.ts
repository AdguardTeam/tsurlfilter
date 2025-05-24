/* eslint-disable no-param-reassign */
import { BaseDeserializer } from '../base-deserializer.js';
import { type ListItem, ListItemNodeType } from '../../nodes/index.js'; // Removed duplicate type declaration
import { NULL } from '../../utils/constants.js';
import { type InputByteBuffer } from '../../utils/input-byte-buffer.js';
import { ListItemMarshallingMap } from '../../marshalling-utils/misc/list-item-common.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';

/**
 * `ListItemDeserializer` is responsible for deserializing list item nodes from binary format.
 *
 * @example
 * `app`, `domain`, `method`, `stealth-option`
 */
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
            case BinaryTypeMarshallingMap.AppNode:
                node.type = ListItemNodeType.App as T;
                break;

            case BinaryTypeMarshallingMap.DomainNode:
                node.type = ListItemNodeType.Domain as T;
                break;

            case BinaryTypeMarshallingMap.MethodNode:
                node.type = ListItemNodeType.Method as T;
                break;

            case BinaryTypeMarshallingMap.StealthOptionNode:
                node.type = ListItemNodeType.StealthOption as T;
                break;

            default:
                throw new Error(`Invalid list item type: ${type}`);
        }

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ListItemMarshallingMap.Exception:
                    node.exception = buffer.readUint8() === 1;
                    break;

                case ListItemMarshallingMap.Value:
                    node.value = buffer.readString();
                    break;

                case ListItemMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ListItemMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${type}`);
            }

            prop = buffer.readUint8();
        }
    };
}
