import type { ByteBuffer } from './byte-buffer';

/**
 * The {@link BinaryMap} is a read-only API for Map<uint32, uint32> representation in {@link ByteBuffer}.
 * The primary usage case is indexing the {@link RuleStorage} storage ids.
 * The value is passed as the position of the {@link U32LinkedList} with {@link RuleStorage} ids.
 */
export class BinaryMap {
    /**
     * Reserved position for the 'undefined' value
     */
    private static readonly EMPTY_POSITION = 0;

    /**
     * Creates binary representation of the passed {@link map} in the {@link buffer}.
     * @param map The Map<uint32, uint32> to be represented in the {@link buffer}.
     * @param buffer The {@link ByteBuffer} to store the binary representation.
     * @returns The position of the binary Map representation in the {@link buffer}.
     */
    public static create(map: Map<number, number>, buffer: ByteBuffer): number {
        const { size } = map;
        const { byteOffset } = buffer;

        let cursor = byteOffset;

        // set hashmap size.
        buffer.addUint32(cursor, size);
        cursor += 4; // Uint32Array.BYTES_PER_ELEMENT

        // reserve space for the lookup indexes.
        const endOfLookup = size * Uint32Array.BYTES_PER_ELEMENT + cursor;

        while (cursor < endOfLookup) {
            buffer.addUint32(cursor, BinaryMap.EMPTY_POSITION);
            cursor += 4; // Uint32Array.BYTES_PER_ELEMENT
        }

        /**
         * To avoid hash collisions, we use separate chaining.
         * This is the temporary structure to map hashes with related chains.
         */
        const chainsMap: Map<number, number[]> = new Map();

        // Add key-value pairs to the buffer and map chain hashes with entries buffer positions.
        map.forEach((value, key) => {
            const keyPosition = cursor;
            buffer.addUint32(cursor, key);
            cursor += 4; // Uint32Array.BYTES_PER_ELEMENT
            buffer.addUint32(cursor, value);
            cursor += 4; // Uint32Array.BYTES_PER_ELEMENT
            // key is a djb2 hash of the string.
            const hash = key % size;

            // Add the key hash to the chain.
            if (!chainsMap.has(hash)) {
                chainsMap.set(hash, []);
            }

            // Map key position with hash.
            chainsMap.get(hash)!.push(keyPosition);
        });

        // Write chains to the buffer and map chain positions with hashes.
        chainsMap.forEach((value, hash) => {
            const chainPosition = cursor;
            buffer.addUint32(cursor, value.length);
            cursor += 4; // Uint32Array.BYTES_PER_ELEMENT

            value.forEach((element) => {
                buffer.addUint32(cursor, element);
                cursor += 4; // Uint32Array.BYTES_PER_ELEMENT
            });

            // Map chain position with lookup index.
            buffer.setUint32(
                hash
                * 4 // Uint32Array.BYTES_PER_ELEMENT
                + 4 // Uint32Array.BYTES_PER_ELEMENT
                + byteOffset,
                chainPosition,
            );
        });

        return byteOffset;
    }

    /**
     * Gets the value from the {@link BinaryMap} in the {@link buffer}.
     * @param input The hash key.
     * @param buffer The {@link ByteBuffer} where {@link BinaryMap} stored.
     * @param offset The position of the {@link BinaryMap} in the {@link buffer}.
     * @returns The matched value or undefined if the key is not found.
     */
    public static get(input: number, buffer: ByteBuffer, offset: number): number | undefined {
        // Get size of the hashmap.
        const size = buffer.getUint32(offset);

        // Re-calculate the hash, depending on the size of the hashmap.
        const hash = input % size;

        // Get the position of the chain.
        const chainPosition = buffer.getUint32(
            hash
            * 4 // Uint32Array.BYTES_PER_ELEMENT
            + 4 // Uint32Array.BYTES_PER_ELEMENT
            + offset,
        );

        // If the chain position is empty, data is not found.
        if (chainPosition === BinaryMap.EMPTY_POSITION) {
            return undefined;
        }

        const chainLength = buffer.getUint32(chainPosition);

        // Get the position of the first entry in the chain.
        let cursor = chainPosition + 4; // Uint32Array.BYTES_PER_ELEMENT
        // Calculate the end of the chain.
        const endOfChain = cursor + (chainLength * 4/** Uint32Array.BYTES_PER_ELEMENT */);

        // Iterate over the chain and find the key.
        while (cursor < endOfChain) {
            const keyPosition = buffer.getUint32(cursor);
            const key = buffer.getUint32(keyPosition);

            if (key === input) {
                // If the key is found, return the value.
                return buffer.getUint32(keyPosition + 4 /** Uint32Array.BYTES_PER_ELEMENT */);
            }

            cursor += 4; // Uint32Array.BYTES_PER_ELEMENT
        }

        // If the key is not found, return undefined.
        return undefined;
    }
}
