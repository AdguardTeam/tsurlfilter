import { type ListItem, type ListItemNodeType } from '../../nodes/index.js';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer.js';
import { ListItemSerializer } from './list-item-serializer.js';

/**
 * Serializer for list items.
 */
export class ListItemsSerializer {
    /**
     * Serializes a list of items to binary format.
     *
     * @param items List of items to serialize.
     * @param buffer Output byte buffer.
     * @template T Type of the list items.
     */
    public static serialize<T extends ListItemNodeType>(
        items: ListItem<T>[],
        buffer: OutputByteBuffer,
    ): void {
        const { length } = items;
        buffer.writeUint16(length);

        for (let i = 0; i < length; i += 1) {
            ListItemSerializer.serialize(items[i], buffer);
        }
    }
}
