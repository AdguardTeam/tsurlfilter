import { TrieNode } from './trie';
import type { ByteBuffer } from './byte-buffer';

/**
 * Binary representation of a trie data structure.
 *
 * value – pointer to rule storage indexes in byte buffer
 *
 * |   value  | children | child key | child position |
 * |  uint32  |   uint8  |   uint8   |     uint32     |
 */
export class BinaryTrie {
    public static create(root: TrieNode, buffer: ByteBuffer): number {
        const { byteOffset } = buffer;

        let cursor = byteOffset;

        const createNode = (node: TrieNode): void => {
            const createNodeEntry = (node: TrieNode, key: number): void => {
                // TODO implement
            };

            // Allocate space for values, to populate it later
            // TODO handle min shortcut size 3
            buffer.addUint32(byteOffset, 0);
            cursor += 4;

            if (!node.children) {
                buffer.addUint32(byteOffset, 0);
                return;
            }

            if (node.children instanceof TrieNode) {
                buffer.addUint32(byteOffset, 1);
                createNodeEntry(node.children, node.children.code);
                return;
            }

            // Many children case
            buffer.addUint32(byteOffset, node.children.size);

            node.children.forEach(createNodeEntry);
            node.children.forEach(createNode);
        };

        createNode(root);

        return cursor;
    }
}
