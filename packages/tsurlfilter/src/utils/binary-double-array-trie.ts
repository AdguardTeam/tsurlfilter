/* eslint-disable jsdoc/require-jsdoc */
import { TrieNode } from './trie';
import type { ByteBuffer } from './byte-buffer';

/**
 * The BinaryDoubleArrayTrie is an immutable, high-performance Double-Array Trie.
 * It efficiently stores a Trie in a flat ByteBuffer, enabling **fast lookups** with O(1) access per character.
 *
 * Data Layout:
 *
 * Each node is stored as:
 *   - `uint32` value  (data attached to the node, or 0 if none)
 *   - `uint32` base   (transition offset for child nodes)
 *   - `uint32` check  (parent node index for validation).
 *
 * Example Buffer Structure:.
 * ```
 *  [ totalSize: uint32 ]
 *  [ value[0], base[0], check[0] ]   // Root node
 *  [ value[1], base[1], check[1] ]   // Node 1
 *  [ value[2], base[2], check[2] ]   // Node 2
 * ```
 */
export class BinaryDoubleArrayTrie {
    /**
     * Number of uint32 values per node in the Double-Array Trie (value, base, check).
     */
    // private static readonly NODE_SIZE = 3;

    /**
     * Reserved value for an empty node.
     */
    private static readonly EMPTY_VALUE = 0;

    /**
     * Creates a BinaryDoubleArrayTrie from a given TrieNode and writes it into a ByteBuffer.
     *
     * @param root The root TrieNode.
     * @param buffer The ByteBuffer where the Double-Array Trie will be stored.
     *
     * @returns The byte offset where the trie is stored in the buffer.
     */
    public static create(root: TrieNode, buffer: ByteBuffer): number {
        const {
            base,
            check,
            value,
            size,
        } = BinaryDoubleArrayTrie.buildDoubleArray(root);

        const startOffset = buffer.byteOffset;

        // Write the total size of the trie (number of nodes)
        buffer.addUint32(buffer.byteOffset, size);

        // Write each node's value, base, and check
        for (let i = 0; i < size; i += 1) {
            buffer.addUint32(buffer.byteOffset, value[i]);
            buffer.addUint32(buffer.byteOffset, base[i]);
            buffer.addUint32(buffer.byteOffset, check[i]);
        }

        return startOffset;
    }

    /**
     * Traverses the trie with the given input string and all its substrings,
     * collecting values of all matching nodes.
     *
     * @param input The input string to traverse.
     * @param depth The maximum substring length to check.
     * @param buffer The ByteBuffer containing the trie.
     * @param offset The byte offset of the trie in the buffer.
     *
     * @returns An array of found values during traversal.
     */
    // public static traverseAll(
    //     input: string,
    //     depth: number,
    //     buffer: ByteBuffer,
    //     offset: number,
    // ): number[] {
    //     const result: number[] = [];

    //     // Read the total size of the trie
    //     const totalSize = buffer.getUint32(offset);
    //     const arrayStart = offset + 4;

    //     // Helper functions to get value, base, and check
    //     const getValue = (index: number) => buffer.getUint32(arrayStart + index * 12);
    //     const getBase = (index: number) => buffer.getUint32(arrayStart + index * 12 + 4);
    //     const getCheck = (index: number) => buffer.getUint32(arrayStart + index * 12 + 8);

    //     for (let i = 0; i <= depth; i += 1) {
    //         let current = 1; // Start at root

    //         for (let j = i; j < depth; j += 1) {
    //             const code = input.charCodeAt(j);
    //             const baseVal = getBase(current);
    //             if (!baseVal) {
    //                 break; // No children
    //             }

    //             const nextIndex = baseVal + code;
    //             if (nextIndex >= totalSize || getCheck(nextIndex) !== current) {
    //                 break;
    //             }

    //             current = nextIndex;
    //             const val = getValue(current);

    //             if (val !== BinaryDoubleArrayTrie.EMPTY_VALUE) {
    //                 result.push(val);
    //             }
    //         }
    //     }

    //     return result;
    // }
    public static traverseAll(
        input: string,
        depth: number,
        buffer: ByteBuffer,
        offset: number,
    ): number[] {
        const result: number[] = [];
        const totalSize = buffer.getUint32(offset);
        const arrayStart = offset + 4;

        let current = 1; // Start at root

        for (let i = 0; i <= depth; i += 1) {
            current = 1; // Reset for each substring

            for (let j = i; j < depth; j += 1) {
                const code = input.charCodeAt(j);
                const index = arrayStart + current * 12; // Precompute index
                const baseVal = buffer.getUint32(index + 4);

                if (!baseVal) {
                    break; // No children
                }

                const nextIndex = baseVal + code;
                if (nextIndex >= totalSize) {
                    break;
                }

                const nextPos = arrayStart + nextIndex * 12; // Precompute next position
                if (buffer.getUint32(nextPos + 8) !== current) {
                    break;
                }

                current = nextIndex;
                const val = buffer.getUint32(nextPos);

                if (val !== BinaryDoubleArrayTrie.EMPTY_VALUE) {
                    result.push(val);
                }
            }
        }

        return result;
    }

    private static buildDoubleArray(root: TrieNode): {
        base: number[];
        check: number[];
        value: number[];
        size: number;
    } {
        let capacity = 256;

        const base: number[] = new Array(capacity).fill(0);
        const check: number[] = new Array(capacity).fill(0);
        const value: number[] = new Array(capacity).fill(0);
        const used: boolean[] = new Array(capacity).fill(false);

        let nextIndex = 1;

        used[1] = true;

        function expand(newCap: number): void {
            while (capacity < newCap) {
                capacity *= 2;
            }
            base.length = capacity;
            check.length = capacity;
            value.length = capacity;
            used.length = capacity;
        }

        function findBase(codes: number[]): number {
            let b = 1;
            while (true) {
                let valid = true;
                for (const c of codes) {
                    const slot = b + c;

                    if (slot >= capacity) {
                        expand(slot + 1);
                    }

                    if (used[slot]) {
                        valid = false;
                        break;
                    }
                }

                if (valid) {
                    return b;
                }

                b += 1;
            }
        }

        function assign(node: TrieNode, index: number): void {
            if (typeof node.data === 'number') value[index] = node.data;
            if (!node.children) return;

            let childNodes: TrieNode[] = [];
            let childCodes: number[] = [];

            if (node.children instanceof TrieNode) {
                childNodes = [node.children];
                childCodes = [node.children.code];
            } else {
                const sorted = Array.from(node.children.values()).sort((a, b) => a.code - b.code);

                childNodes = sorted;
                childCodes = sorted.map((c) => c.code);
            }

            const b = findBase(childCodes);
            base[index] = b;

            for (let i = 0; i < childCodes.length; i += 1) {
                const c = childCodes[i];
                const childIndex = b + c;

                if (childIndex >= capacity) {
                    expand(childIndex + 1);
                }

                used[childIndex] = true;
                check[childIndex] = index;

                if (childIndex > nextIndex) {
                    nextIndex = childIndex;
                }
            }

            for (let i = 0; i < childCodes.length; i += 1) {
                assign(childNodes[i], b + childCodes[i]);
            }
        }

        assign(root, 1);

        const size = nextIndex + 1;

        base.length = size;
        check.length = size;
        value.length = size;

        return {
            base,
            check,
            value,
            size,
        };
    }
}
