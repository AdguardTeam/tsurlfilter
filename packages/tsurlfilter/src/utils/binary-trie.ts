import { TrieNode } from './trie';
import type { ByteBuffer } from './byte-buffer';

/**
 * Binary representation of a trie data structure.
 *
 * |  value  | children | child key | child position |
 * |  uint32 |  uint8   |   uint8   |     uint32     |
 */
export class BinaryTrie {
    // Reserved position for the 'undefined' value
    private static readonly EMPTY_POSITION = 0;

    public static create(root: TrieNode, buffer: ByteBuffer): number {
        const { byteOffset } = buffer;

        let offset = byteOffset;

        const createNode = (node: TrieNode) => {
            let cursor = offset + BinaryTrie.getNodeByteSize(node);

            buffer.addUint32(offset, node.data ?? BinaryTrie.EMPTY_POSITION);
            offset += 4;

            if (node.children === undefined) {
                // Set children length to 0.
                buffer.addUint8(offset, 0);
                offset += 1;
                return;
            }

            // Single child case.
            if (node.children instanceof TrieNode) {
                // Set children length to 1.
                buffer.addUint8(offset, 1);
                offset += 1;
                // Set child key.
                buffer.addUint8(offset, node.children.code);
                offset += 1;

                // Set child position.
                buffer.addUint32(offset, cursor);
                offset += 4;
                cursor += BinaryTrie.getByteSize(node.children);

                createNode(node.children);
                return;
            }

            // Many children case.
            buffer.addUint8(offset, node.children.size);
            offset += 1;

            const createChildEntry = (child: TrieNode) => {
                // Set child key
                buffer.addUint8(offset, child.code);
                offset += 1;

                // Allocate space for child position to populate it later
                buffer.addUint32(offset, cursor);
                offset += 4;
                cursor += BinaryTrie.getByteSize(child);
            };

            node.children.forEach(createChildEntry);
            node.children.forEach(createNode);
        };

        createNode(root);

        return byteOffset;
    }

    public static traverse(
        input: string,
        start: number,
        buffer: ByteBuffer,
        offset: number,
    ) {
        let position = offset;
        const result: number[] = [];

        for (let i = start; i < input.length; i += 1) {
            const code = input.charCodeAt(i);
            position = BinaryTrie.findChild(code, buffer, position);

            if (position === -1) {
                break;
            }

            const value = buffer.getUint32(position);

            if (value !== BinaryTrie.EMPTY_POSITION) {
                result.push(value);
            }
        }

        return result;
    }

    public static traverseAll(
        input: string,
        length: number,
        buffer: ByteBuffer,
        offset: number,
    ): number[] {
        const result: number[] = [];

        for (let i = 0; i <= length; i += 1) {
            const positions = BinaryTrie.traverse(input, i, buffer, offset);
            for (let j = 0; j < positions.length; j += 1) {
                result.push(positions[j]);
            }
        }

        return result;
    }

    private static findChild(charCode: number, buffer: ByteBuffer, offset: number): number {
        let cursor = offset + 4;

        let children = buffer.getUint8(cursor);
        cursor += 1;

        while (children > 0) {
            const childKey = buffer.getUint8(cursor);
            cursor += 1;

            if (childKey === charCode) {
                return buffer.getUint32(cursor);
            }

            cursor += 4;
            children -= 1;
        }

        return -1;
    }

    private static getByteSize(root: TrieNode): number {
        let estimated = BinaryTrie.getNodeByteSize(root);

        if (root.children === undefined) {
            return estimated;
        }

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
