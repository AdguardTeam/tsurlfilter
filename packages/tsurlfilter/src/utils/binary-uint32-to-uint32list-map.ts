import type { ByteBuffer } from './byte-buffer';

/**
 * The {@link BinaryUint32ToUint32ListMap} is a read-only API for Map<uint32, uint32[]> representation in
 * {@link ByteBuffer}.
 * The primary usage case is indexing IDs where a key can map to multiple values.
 */
export class BinaryUint32ToUint32ListMap {
    /**
     * Reserved position for the 'undefined' chain position.
     */
    private static readonly EMPTY_POSITION = 0;

    /**
     * Creates a binary representation of the passed Map<uint32, uint32[]> in the {@link buffer}.
     *
     * The binary layout is similar to {@link BinaryMap} but stores multiple values for each key:
     *
     * 1) [ size (4 bytes) ] – the number of distinct keys
     * 2) [ lookup table (size * 4 bytes) ] – each entry is a pointer to the chain for that hash slot
     * 3) [ key-data blocks ] – for each key:
     *    - key (4 bytes)
     *    - numberOfValues (4 bytes)
     *    - value[0] (4 bytes)
     *    - ...
     *    - value[numberOfValues-1] (4 bytes)
     * 4) [ chain sections ] – one per hash bucket:
     *    - chainLength (4 bytes)
     *    - keyPosition pointer[0] (4 bytes)
     *    - ...
     *    - keyPosition pointer[chainLength-1] (4 bytes).
     *
     * @param map The Map<uint32, uint32[]> to be represented in the {@link buffer}.
     * @param buffer The {@link ByteBuffer} to store the binary representation.
     *
     * @returns The position of the binary multi-map representation in the {@link buffer}.
     */
    public static create(map: Map<number, number[]>, buffer: ByteBuffer): number {
        const { size } = map;
        const { byteOffset } = buffer;

        let cursor = byteOffset;

        // 1) Write the size (number of distinct keys).
        buffer.addUint32(cursor, size);
        cursor += 4; // 4 bytes for uint32

        // 2) Reserve space for the lookup table (size pointers).
        const endOfLookup = size * 4 + cursor; // size * Uint32Array.BYTES_PER_ELEMENT

        while (cursor < endOfLookup) {
            buffer.addUint32(cursor, BinaryUint32ToUint32ListMap.EMPTY_POSITION);
            cursor += 4;
        }

        /**
         * Similar to BinaryMap, we'll build a temporary structure:
         *   hash -> array of keyPositions.
         */
        const chainsMap: Map<number, number[]> = new Map();

        // 3) Write the key-data blocks.
        map.forEach((values: number[], key: number) => {
            // Record where this key block starts in the buffer.
            const keyPosition = cursor;

            // Write the key
            buffer.addUint32(cursor, key);
            cursor += 4;

            // Write number of values
            buffer.addUint32(cursor, values.length);
            cursor += 4;

            // Write all the values
            for (const val of values) {
                buffer.addUint32(cursor, val);
                cursor += 4;
            }

            // Compute the hash for the key
            const hash = key % size;

            // Collect keyPosition in a chain
            if (!chainsMap.has(hash)) {
                chainsMap.set(hash, []);
            }
            chainsMap.get(hash)!.push(keyPosition);
        });

        // 4) Write the chain sections
        chainsMap.forEach((keyPositions, hash) => {
            // Mark where this particular chain begins
            const chainPosition = cursor;

            // Write how many key pointers are in this chain
            buffer.addUint32(cursor, keyPositions.length);
            cursor += 4;

            // Write the pointer to each key
            for (const kp of keyPositions) {
                buffer.addUint32(cursor, kp);
                cursor += 4;
            }

            // Store the chain position in the lookup table
            buffer.setUint32(
                hash * 4 + (byteOffset + 4),
                chainPosition,
            );
        });

        return byteOffset;
    }

    /**
     * Gets the array of values from the {@link BinaryUint32ToUint32ListMap} in the {@link buffer}.
     *
     * @param input The hash key.
     * @param buffer The {@link ByteBuffer} where the {@link BinaryUint32ToUint32ListMap} is stored.
     * @param offset The position of the {@link BinaryUint32ToUint32ListMap} in the {@link buffer}.
     *
     * @returns The matched values (as number[]) or undefined if the key is not found.
     */
    public static get(input: number, buffer: ByteBuffer, offset: number): number[] | undefined {
        // 1) Retrieve the number of distinct keys
        const size = buffer.getUint32(offset);

        // 2) Compute the hash for the input
        const hash = input % size;

        // 3) Lookup the chain's position
        const chainPosition = buffer.getUint32(offset + 4 + (hash * 4));

        if (chainPosition === BinaryUint32ToUint32ListMap.EMPTY_POSITION) {
            // If there's no chain here, no values for that key
            return undefined;
        }

        // 4) Read chain length and iterate to find the correct key
        const chainLength = buffer.getUint32(chainPosition);
        let chainCursor = chainPosition + 4;
        const chainEnd = chainCursor + chainLength * 4;

        while (chainCursor < chainEnd) {
            const keyPosition = buffer.getUint32(chainCursor);
            const storedKey = buffer.getUint32(keyPosition);

            if (storedKey === input) {
                // Found the key; gather the stored values
                const valueCount = buffer.getUint32(keyPosition + 4);
                const result: number[] = [];

                let valueCursor = keyPosition + 8;

                for (let i = 0; i < valueCount; i += 1) {
                    result.push(buffer.getUint32(valueCursor));
                    valueCursor += 4;
                }
                return result;
            }

            chainCursor += 4;
        }

        // Key not found in the chain
        return undefined;
    }
}
