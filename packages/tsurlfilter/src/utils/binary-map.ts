import { ByteBuffer } from './byte-buffer';

/**
 * Binary representation of the readonly {@link Map}.
 * It can be easily written to the buffer and used without deserialization.
 */
export class BinaryMap {
    // Reserved position for the 'undefined' value
    private static readonly EMPTY_POSITION = 0;

    private readonly offset: number;

    private readonly buffer: ByteBuffer;

    constructor(map: Map<number, number>, buffer: ByteBuffer, offset: number) {
        this.buffer = buffer;
        this.offset = offset;

        const { size } = map;

        let cursor = this.offset;

        // set size
        this.buffer.addUint32(cursor, size);
        cursor += 4;

        const endOfLookup = size * 4 + cursor;

        while (cursor < endOfLookup) {
            this.buffer.addUint32(cursor, BinaryMap.EMPTY_POSITION);
            cursor += 4;
        }

        // Temporary structure to map hashes with matched values
        const bucketsMap: Map<number, number[]> = new Map();

        map.forEach((value, key) => {
            const keyPosition = cursor;
            this.buffer.addUint32(cursor, key);
            cursor += 4;
            this.buffer.addUint32(cursor, value);
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
            this.buffer.addUint32(cursor, value.length);
            cursor += 4;

            value.forEach((element) => {
                this.buffer.addUint32(cursor, element);
                cursor += 4;
            });

            // Map bucket position with hash
            this.buffer.setUint32(key * 4 + 4 + this.offset, bucketPosition);
        });
    }

    public get(input: number): number | undefined {
        const size = this.buffer.getUint32(this.offset);

        // Get the bucket position
        const hash = input % size;
        const bucketPosition = this.buffer.getUint32(hash * 4 + 4 + this.offset);

        // If the bucket position is empty, data is not found
        if (bucketPosition === BinaryMap.EMPTY_POSITION) {
            return undefined;
        }

        // Get the bucket
        const bucketLength = this.buffer.getUint32(bucketPosition);

        let cursor = bucketPosition + 4;
        const endOfBucket = cursor + (bucketLength * 4);

        while (cursor < endOfBucket) {
            const keyPosition = this.buffer.getUint32(cursor);
            const key = this.buffer.getUint32(keyPosition);

            if (key === input) {
                return this.buffer.getUint32(keyPosition + 4);
            }

            cursor += 4;
        }

        return undefined;
    }
}
