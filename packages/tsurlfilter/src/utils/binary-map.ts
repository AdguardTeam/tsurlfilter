import { ByteBuffer } from './byte-buffer';

/**
 * Binary representation of the readonly {@link Map}.
 * It can be easily written to the buffer and used without deserialization.
 */
export class BinaryMap {
    // Reserved position for the 'undefined' value
    private static readonly EMPTY_POSITION = 0;

    public static create(map: Map<number, number>, buffer: ByteBuffer): number {
        const { size } = map;
        const { byteOffset } = buffer;

        let cursor = byteOffset;

        // set size
        buffer.addUint32(cursor, size);
        cursor += 4;

        const endOfLookup = size * 4 + cursor;

        while (cursor < endOfLookup) {
            buffer.addUint32(cursor, BinaryMap.EMPTY_POSITION);
            cursor += 4;
        }

        // Temporary structure to map hashes with matched values
        const bucketsMap: Map<number, number[]> = new Map();

        map.forEach((value, key) => {
            const keyPosition = cursor;
            buffer.addUint32(cursor, key);
            cursor += 4;
            buffer.addUint32(cursor, value);
            cursor += 4;
            // key is a djb2 hash of the string
            const hash = key % size;

            // Add the key hash to the buckets
            if (!bucketsMap.has(hash)) {
                bucketsMap.set(hash, []);
            }

            // Map key position with hash
            bucketsMap.get(hash)!.push(keyPosition);
        });

        bucketsMap.forEach((value, key) => {
            const bucketPosition = cursor;
            buffer.addUint32(cursor, value.length);
            cursor += 4;

            value.forEach((element) => {
                buffer.addUint32(cursor, element);
                cursor += 4;
            });

            // Map bucket position with hash
            buffer.setUint32(key * 4 + 4 + byteOffset, bucketPosition);
        });

        return byteOffset;
    }

    public static get(input: number, buffer: ByteBuffer, offset: number): number | undefined {
        const size = buffer.getUint32(offset);

        // Get the bucket position
        const hash = input % size;
        const bucketPosition = buffer.getUint32(hash * 4 + 4 + offset);

        // If the bucket position is empty, data is not found
        if (bucketPosition === BinaryMap.EMPTY_POSITION) {
            return undefined;
        }

        // Get the bucket
        const bucketLength = buffer.getUint32(bucketPosition);

        let cursor = bucketPosition + 4;
        const endOfBucket = cursor + (bucketLength * 4);

        while (cursor < endOfBucket) {
            const keyPosition = buffer.getUint32(cursor);
            const key = buffer.getUint32(keyPosition);

            if (key === input) {
                return buffer.getUint32(keyPosition + 4);
            }

            cursor += 4;
        }

        return undefined;
    }
}
