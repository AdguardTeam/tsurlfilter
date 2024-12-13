/* eslint-disable no-param-reassign */
import { type ListItem, type ListItemNodeTypeType } from '../../nodes';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { ListItemDeserializer } from './list-item-deserializer';

/**
 * Deserializes lists of items from binary format.
 * Converts binary data to structured item nodes.
 */
export class ListItemsDeserializer {
    /**
     * Deserializes a list of items from binary format.
     *
     * @param buffer Input byte buffer.
     * @param items Partial list of items to deserialize.
     * @template T Type of the list items.
     */
    public static deserialize = <T extends ListItemNodeTypeType>(
        buffer: InputByteBuffer,
        items: Partial<ListItem<T>>[],
    ): void => {
        const length = buffer.readUint16();
        items.length = length;

        for (let i = 0; i < length; i += 1) {
            ListItemDeserializer.deserialize(buffer, items[i] = {});
        }
    };
}
