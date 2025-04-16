import type { ByteBuffer } from './byte-buffer';
import { fastHash, stringToUtf16Array, utf16ArrayEqualsString } from './string-utils';

/**
 * Stores a Map<string, number[]> in a ByteBuffer and allows for fast lookups.
 *
 * Layout:
 *
 * [0..3] = size (distinct keys)           (uint32)
 * [4..(4 + size*4)-1] = lookup table      (size * uint32) -> pointers to chain sections
 * ... Then for each entry (key -> number[]):
 *    - hash (4 bytes)                     (uint32)
 *    - utf16Length (4 bytes)              (uint32)
 *    - utf16Data (utf16Length * 2 bytes)
 *    - valuesCount (4 bytes)              (uint32)
 *    - values (valuesCount * 4 bytes)
 * ... Then for each hash bucket's chain:
 *    - chainLength (4 bytes)              (uint32)
 *    - keyPosition[] (chainLength * 4)    (uint32[] pointers to the key-data).
 */
export class BinaryStringMultiMap {
    /**
     * Reserved pointer for 'no chain'.
     */
    private static readonly EMPTY_POSITION = 0;

    /**
     * Creates a binary representation of the passed Map<string, number[]>
     * in the provided ByteBuffer.
     *
     * @param map    A Map<string, number[]> to store.
     * @param buffer The ByteBuffer in which to store.
     *
     * @returns      The offset (start) in the buffer where the map begins.
     */
    public static create(map: Map<string, number[]>, buffer: ByteBuffer): number {
        // 1) Write the number of distinct keys.
        const { size } = map;
        const { byteOffset } = buffer;

        let cursor = byteOffset;

        // Write the map size.
        buffer.addUint32(cursor, size);
        cursor += 4;

        // 2) Reserve space for the lookup table (size pointers).
        const endOfLookup = cursor + (size * 4);

        while (cursor < endOfLookup) {
            buffer.addUint32(cursor, BinaryStringMultiMap.EMPTY_POSITION);
            cursor += 4;
        }

        // We'll store chain references in a temporary structure: hash -> keyPositions
        const chainsMap: Map<number, number[]> = new Map();

        // 3) Write each key-data block.
        for (const [key, values] of map.entries()) {
            // Precompute the hash
            const hash = fastHash(key);

            // This is where this key-data begins
            const keyPosition = cursor;

            // a) Store the hash
            buffer.addUint32(cursor, hash);
            cursor += 4;

            // b) Store the string in UTF-16
            //    i) length in code units
            const utf16Array = stringToUtf16Array(key);

            buffer.addUint32(cursor, utf16Array.length);
            cursor += 4;

            //    ii) store each code unit (2 bytes each)
            for (const codeUnit of utf16Array) {
                buffer.addUint16(cursor, codeUnit);
                cursor += 2;
            }

            // c) Store the values array
            buffer.addUint32(cursor, values.length);
            cursor += 4;

            for (const val of values) {
                buffer.addUint32(cursor, val);
                cursor += 4;
            }

            // Insert into chainsMap
            const bucketIndex = hash % size;

            if (!chainsMap.has(bucketIndex)) {
                chainsMap.set(bucketIndex, []);
            }

            chainsMap.get(bucketIndex)!.push(keyPosition);
        }

        // 4) Write the chain sections
        chainsMap.forEach((keyPositions, bucketIndex) => {
            const chainPosition = cursor;

            // a) how many key pointers in this chain
            buffer.addUint32(cursor, keyPositions.length);
            cursor += 4;

            // b) store each pointer
            for (const kp of keyPositions) {
                buffer.addUint32(cursor, kp);
                cursor += 4;
            }

            // c) store chainPosition into the lookup table
            //    table starts at byteOffset + 4
            //    index = bucketIndex * 4
            buffer.setUint32(byteOffset + 4 + (bucketIndex * 4), chainPosition);
        });

        return byteOffset;
    }

    /**
     * Retrieves the array of numbers for the given string key
     * from the binary map stored at `offset` within `buffer`.
     *
     * @param input The string key to look up.
     * @param buffer The ByteBuffer containing the map.
     * @param offset The byte offset where the map starts in `buffer`.
     *
     * @returns The array of numbers for this key, or undefined if not found.
     */
    public static get(input: string, buffer: ByteBuffer, offset: number): number[] | undefined {
        // 1) Number of distinct keys
        const size = buffer.getUint32(offset);

        if (size === 0) {
            return undefined;
        }

        // 2) Compute hash and find chain
        const hash = fastHash(input);
        const bucketIndex = hash % size;

        // The chain pointer is at offset+4 + (bucketIndex * 4)
        const chainPosition = buffer.getUint32(offset + 4 + (bucketIndex * 4));
        if (chainPosition === BinaryStringMultiMap.EMPTY_POSITION) {
            // No chain for this bucket => not found
            return undefined;
        }

        // 3) Traverse the chain
        const chainLength = buffer.getUint32(chainPosition);
        let chainCursor = chainPosition + 4;
        const chainEnd = chainCursor + chainLength * 4;

        while (chainCursor < chainEnd) {
            const keyPosition = buffer.getUint32(chainCursor);
            chainCursor += 4;

            // a) Read stored hash
            const storedHash = buffer.getUint32(keyPosition);

            if (storedHash === hash) {
                // Potential match – verify the string
                // b) read the utf16 length
                const strLength = buffer.getUint32(keyPosition + 4);
                let strCursor = keyPosition + 8;

                // c) read out the code units
                const codeUnits: number[] = [];
                for (let i = 0; i < strLength; i += 1) {
                    codeUnits.push(buffer.getUint16(strCursor));
                    strCursor += 2;
                }

                // Compare codeUnits to the input string’s code units
                if (utf16ArrayEqualsString(codeUnits, input)) {
                    // If they match, read the values array
                    const valuesCount = buffer.getUint32(strCursor);
                    strCursor += 4;

                    const results: number[] = [];
                    for (let i = 0; i < valuesCount; i += 1) {
                        results.push(buffer.getUint32(strCursor));
                        strCursor += 4;
                    }
                    return results;
                }
            }
            // If hash mismatch (or string mismatch), continue searching chain.
        }

        // Key not found
        return undefined;
    }
}
