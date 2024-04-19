import type { ByteBuffer } from './byte-buffer';

/**
 * Binary view for uint32 linked list that is used to create a collection in the {@link ByteBuffer}.
 * Unlike arrays, this structure allows elements to be added at any position in the buffer without
 * creating or recreating additional index structures.
 * However, it has a low search speed of O(n).
 * We use this structure to dynamically write {@link RuleStorage} indexes.
 * After filling the ByteBuffer with data, we iterate through the {@link U32LinkedList}
 * to build index structures like {@link BinaryMap} and {@link BinaryTrie}.
 * These structures allow for constant-time search of items in the collection.
 */
export class U32LinkedList {
    /**
     * Reserved position for the 'undefined' value.
     */
    public static readonly EMPTY_POSITION = 0;

    /**
     * Adds a new value to the list.
     * @param value The uint32 value to add.
     * @param buffer The buffer to add the value to.
     * @param listPosition The position of the list in the buffer.
     */
    public static add(value: number, buffer: ByteBuffer, listPosition: number): void {
        const position = buffer.byteOffset;

        buffer.addUint32(position, value);
        const lastNodePosition = U32LinkedList.getLastNodePosition(buffer, listPosition);
        buffer.addUint32(position + 4 /** Uint32Array.BYTES_PER_ELEMENT */, lastNodePosition);
        U32LinkedList.setLastNodePosition(buffer, listPosition, position);
        const size = U32LinkedList.getSize(buffer, listPosition);
        U32LinkedList.setSize(buffer, listPosition, size + 1);
    }

    /**
     * Gets the specified list node from the buffer.
     * @param position The list node position in the buffer.
     * @param buffer The buffer to get the value from.
     * @returns tuple of the node value and the next node position.
     */
    public static get(position: number, buffer: ByteBuffer): [value: number, next: number] {
        return [
            buffer.getUint32(position),
            buffer.getUint32(position + 4 /** Uint32Array.BYTES_PER_ELEMENT */),
        ];
    }

    /**
     * Iterates through the list and applies the callback to each node.
     * @param callback The function to apply to each node.
     * @param buffer The buffer to iterate through.
     * @param listPosition The list position in the buffer.
     */
    public static forEach(callback: (value: number) => void, buffer: ByteBuffer, listPosition: number): void {
        let cursor = U32LinkedList.getLastNodePosition(buffer, listPosition);

        while (cursor !== U32LinkedList.EMPTY_POSITION) {
            const [nodeValue, nextNodePosition] = U32LinkedList.get(cursor, buffer);
            callback(nodeValue);
            cursor = nextNodePosition;
        }
    }

    /**
     * Finds the first node in the list that satisfies the callback.
     * @param callback The function to apply to each node.
     * @param buffer The buffer to iterate through.
     * @param listPosition The list position in the buffer.
     * @returns The first node value that satisfies the callback.
     * If no node satisfies the callback, returns -1.
     */
    public static find(callback: (value: number) => boolean, buffer: ByteBuffer, listPosition: number): number {
        let cursor = U32LinkedList.getLastNodePosition(buffer, listPosition);

        while (cursor !== U32LinkedList.EMPTY_POSITION) {
            const [nodeValue, nextNodePosition] = U32LinkedList.get(cursor, buffer);
            if (callback(nodeValue)) {
                return nodeValue;
            }
            cursor = nextNodePosition;
        }

        return -1;
    }

    /**
     * FIXME
     * @param callback The function to apply to each node.
     * @param buffer The buffer to iterate through.
     * @param listPosition The list position in the buffer.
     * @returns FIXME
     */
    public static some(callback: (value: number) => boolean, buffer: ByteBuffer, listPosition: number): boolean {
        let cursor = U32LinkedList.getLastNodePosition(buffer, listPosition);

        while (cursor !== U32LinkedList.EMPTY_POSITION) {
            const [nodeValue, nextNodePosition] = U32LinkedList.get(cursor, buffer);
            if (callback(nodeValue)) {
                return true;
            }
            cursor = nextNodePosition;
        }

        return false;
    }

    /**
     * Writes initial list properties to the buffer.
     * @param buffer The buffer to write the initial list data.
     * @returns The position of the list in the buffer.
     */
    public static create(buffer: ByteBuffer): number {
        const { byteOffset } = buffer;

        // Add list size;
        buffer.addUint32(byteOffset, 0);
        // Add last node position
        buffer.addUint32(
            byteOffset + 4 /** Uint32Array.BYTES_PER_ELEMENT */,
            U32LinkedList.EMPTY_POSITION,
        );

        return byteOffset;
    }

    /**
     * Gets the size of the list.
     * @param buffer The buffer to get the size from.
     * @param listPosition The list position in the buffer.
     * @returns The size of list.
     */
    private static getSize(buffer: ByteBuffer, listPosition: number): number {
        return buffer.getUint32(listPosition);
    }

    /**
     * Sets the size of the list.
     * @param buffer The buffer to set the size to.
     * @param listPosition The list position in the buffer.
     * @param value The size of the list.
     */
    private static setSize(buffer: ByteBuffer, listPosition: number, value: number) {
        buffer.setUint32(listPosition, value);
    }

    /**
     * Gets the last node position in the list.
     * @param buffer The buffer to get the last node position from.
     * @param listPosition The list position in the buffer.
     * @returns The last node position in the list.
     */
    private static getLastNodePosition(buffer: ByteBuffer, listPosition: number): number {
        return buffer.getUint32(listPosition + 4 /** Uint32Array.BYTES_PER_ELEMENT */);
    }

    /**
     * Sets the last node position in the list.
     * @param buffer The buffer to set the last node position to.
     * @param listPosition The list position in the buffer.
     * @param value The last node position in the list.
     */
    private static setLastNodePosition(buffer: ByteBuffer, listPosition: number, value: number) {
        buffer.setUint32(listPosition + 4 /** Uint32Array.BYTES_PER_ELEMENT */, value);
    }
}
