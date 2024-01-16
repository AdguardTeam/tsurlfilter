/**
 * Binary representation of the readonly {@link Map}.
 * It can be easily written to the buffer and used without deserialization.
 */
export class BinaryMap {
    // Reserved position for the 'undefined' value
    private static readonly EMPTY_POSITION = 0;

    // Map size
    public size: number;

    // Map keys
    public keys: Uint32Array;

    // Map values
    // TODO: Will be replaced with dynamic byte buffer in future
    // TODO: store indexes to separate array in fixed size Uint32Array;
    public values: number[][] = [];

    // Buckets that store entries positions for each hash
    // TODO: Will be replaced with dynamic byte buffer in future
    public buckets: number[][] = [];

    // Store mapping between hashes and positions of buckets.
    public lookupIndex: Uint32Array;

    constructor(map: Map<number, number[]>) {
        this.size = map.size;
        this.lookupIndex = new Uint32Array(this.size).fill(BinaryMap.EMPTY_POSITION);
        this.keys = new Uint32Array(this.size);

        /**
         * Temporary structure to map hashes with matched values
         * Will be replaced with {@link lookupIndex} and dynamic array of bucket values
         */
        const buckets: Map<number, number[]> = new Map();

        let cursor = 0;

        map.forEach((value, key) => {
            this.values[cursor] = value;
            this.keys[cursor] = key;
            // key is a djb2 hash of the string
            const hash = key % this.size;

            // Add the key hash to the buckets
            if (!buckets.has(hash)) {
                buckets.set(hash, []);
            }

            // Map key position with hash
            buckets.get(hash)!.push(cursor);
            cursor += 1;
        });

        // Reserve space for 'undefined' value
        cursor = 1;

        buckets.forEach((value, key) => {
            this.buckets[cursor] = value;
            // Map bucket position with hash
            this.lookupIndex[key] = cursor;
            cursor += 1;
        });
    }

    public get(input: number): number[] | undefined {
        // Get the bucket position
        const hash = input % this.size;
        const bucketPosition = this.lookupIndex[hash];

        // If the bucket position is empty, data is not found
        if (bucketPosition === BinaryMap.EMPTY_POSITION) {
            return undefined;
        }

        // Get the bucket
        const bucket = this.buckets[bucketPosition];

        for (let i = 0; i < bucket.length; i += 1) {
            const keyPosition = bucket[i];
            const key = this.keys[keyPosition];

            if (key === input) {
                return this.values[keyPosition];
            }
        }

        return undefined;
    }
}
