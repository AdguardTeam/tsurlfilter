import { TrieNode } from './trie';
import type { ByteBuffer } from './byte-buffer';

/**
 * The BinaryTrie is a read-only API that represents a {@link TrieNode}.
 * It can be easily written to and read from a {@link ByteBuffer}.
 * It is used to search for string shortcuts and all their substrings
 * in constant time and map them to the position of the U32LinkedList with RuleStorage ids.
 *
 * The binary representation of the TrieNode in the ByteBuffer is as follows:
 *
 * |  value  | children | child key | child position |
 * |  uint32 |  uint8   |   uint8   |     uint32     |
 *
 */
export class BinaryTrie {
    /**
     * Reserved position for the 'undefined' value.
     */
    private static readonly EMPTY_POSITION = 0;

    /**
     * Creates binary representation of the passed {@link root} in the {@link buffer}.
     *
     * @param root The root node of trie to be represented in the {@link buffer}.
     * @param buffer The {@link ByteBuffer} to store the binary representation of trie.
     * @returns The position of the binary trie representation in the {@link buffer}.
     */
    public static create(root: TrieNode, buffer: ByteBuffer): number {
        const { byteOffset } = buffer;

        let offset = byteOffset;

        /**
         * Writes node and its children to the buffer recursively.
         *
         * @param node The trie node to start from.
         */
        const createNode = (node: TrieNode): void => {
            let cursor = offset + BinaryTrie.getNodeByteSize(node);

            // Sets value.
            buffer.addUint32(offset, node.data ?? BinaryTrie.EMPTY_POSITION);
            offset += 4; // Uint32Array.BYTES_PER_ELEMENT

            // No children case.
            if (node.children === undefined) {
                // Set children length to 0.
                buffer.addUint8(offset, 0);
                offset += 1; // Uint8Array.BYTES_PER_ELEMENT
                return;
            }

            // Single child case.
            if (node.children instanceof TrieNode) {
                // Set children length to 1.
                buffer.addUint8(offset, 1);
                offset += 1; // Uint8Array.BYTES_PER_ELEMENT
                // Set child key.
                buffer.addUint8(offset, node.children.code);
                offset += 1; // Uint8Array.BYTES_PER_ELEMENT

                // Set child position.
                buffer.addUint32(offset, cursor);
                offset += 4; // Uint32Array.BYTES_PER_ELEMENT
                cursor += BinaryTrie.getByteSize(node.children);

                createNode(node.children);
                return;
            }

            // Many children case.
            buffer.addUint8(offset, node.children.size);
            offset += 1; // Uint8Array.BYTES_PER_ELEMENT

            /**
             * Writes child entry to the buffer.
             *
             * @param child Child node entry to write.
             */
            const createChildEntry = (child: TrieNode) => {
                // Set child key
                buffer.addUint8(offset, child.code);
                offset += 1; // Uint8Array.BYTES_PER_ELEMENT

                // Set child position.
                buffer.addUint32(offset, cursor);
                offset += 4; // Uint32Array.BYTES_PER_ELEMENT
                cursor += BinaryTrie.getByteSize(child);
            };

            node.children.forEach(createChildEntry);
            node.children.forEach(createNode);
        };

        createNode(root);

        return byteOffset;
    }

    /**
     * Traverses the trie with the passed {@link input} and all its substrings
     * and collects values of each node.
     *
     * @param input The input string to traverse the trie with.
     * @param depth The depth of traverse.
     * @param buffer The {@link ByteBuffer} to read the trie from.
     * @param offset The position of the trie in the {@link buffer}.
     * @returns Array of values of the nodes traversed.
     */
    public static traverseAll(
        input: string,
        depth: number,
        buffer: ByteBuffer,
        offset: number,
    ): number[] {
        const result: number[] = [];

        for (let i = 0; i <= depth; i += 1) {
            let position = offset;

            for (let j = i; j < depth; j += 1) {
                const code = input.charCodeAt(j);
                position = BinaryTrie.findChild(code, buffer, position);

                if (position === -1) {
                    break;
                }

                const value = buffer.getUint32(position);

                if (value !== BinaryTrie.EMPTY_POSITION) {
                    result.push(value);
                }
            }
        }

        return result;
    }

    /**
     * Finds the position of the child of the trie node.
     *
     * @param charCode The char code of the child to find.
     * @param buffer The {@link ByteBuffer} to read the data from.
     * @param offset The position of the node in the {@link buffer}.
     * @returns The position of the child in the {@link buffer}.
     */
    private static findChild(charCode: number, buffer: ByteBuffer, offset: number): number {
        let cursor = offset + 4; // Uint32Array.BYTES_PER_ELEMENT

        let children = buffer.getUint8(cursor);
        cursor += 1; // Uint8Array.BYTES_PER_ELEMENT

        while (children > 0) {
            const childKey = buffer.getUint8(cursor);
            cursor += 1; // Uint8Array.BYTES_PER_ELEMENT

            if (childKey === charCode) {
                return buffer.getUint32(cursor);
            }

            cursor += 4; // Uint32Array.BYTES_PER_ELEMENT
            children -= 1;
        }

        return -1;
    }

    /**
     * Gets the estimated byte size of the trie node and its children recursively.
     *
     * @param root The root node of the trie.
     * @returns The estimated byte size of the trie node.
     */
    private static getByteSize(root: TrieNode): number {
        let estimated = BinaryTrie.getNodeByteSize(root);

        if (root.children === undefined) {
            return estimated;
        }

        /**
         * Adds the byte size of the node and its children to the estimated size.
         *
         * @param node The trie node to get the byte size of.
         */
        const getNodeSize = (node: TrieNode): void => {
            estimated += BinaryTrie.getByteSize(node);
        };

        if (root.children instanceof TrieNode) {
            getNodeSize(root.children);
            return estimated;
        }

        root.children.forEach(getNodeSize);
        return estimated;
    }

    /**
     * Gets the estimated byte size of the trie node.
     *
     * @param node The trie node to get the byte size of.
     * @returns The estimated byte size of the trie node.
     */
    private static getNodeByteSize(node: TrieNode): number {
        if (node.children === undefined) {
            // 4 bytes for value + 1 byte for children length.
            return 5;
        }

        if (node.children instanceof TrieNode) {
            // 4 bytes for value + 1 byte for children length + 1 byte for child key + 4 bytes for child position.
            return 10;
        }

        /**
         * 4 bytes for value
         * + 1 byte for children length
         * + (1 byte for child key + 4 bytes for child position) * children size.
         */
        return node.children.size * 5 + 5;
    }
}
