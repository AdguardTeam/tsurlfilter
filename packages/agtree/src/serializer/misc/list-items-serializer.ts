import { type ListItem, type ListItemNodeType } from '../../nodes';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { ListItemSerializer } from './list-item-serializer';

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
