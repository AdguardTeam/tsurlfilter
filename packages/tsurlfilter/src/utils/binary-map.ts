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
    public values: Uint32Array;

    // Store mapping between hashes and positions of buckets.
    public lookupIndex: Uint32Array;

    // Buckets that store values positions for each hash
    public buckets: Uint32Array;

    constructor(map: Map<number, number>) {
        this.size = map.size;
        this.lookupIndex = new Uint32Array(this.size).fill(BinaryMap.EMPTY_POSITION);
        this.keys = new Uint32Array(this.size);
        this.values = new Uint32Array(this.size);

        /**
         * Temporary structure to map hashes with matched values
         * Will be replaced with {@link lookupIndex} and {@link buckets}
         */
        const bucketsMap: Map<number, number[]> = new Map();

        let cursor = 0;

        map.forEach((value, key) => {
            this.values[cursor] = value;
            this.keys[cursor] = key;
            // key is a djb2 hash of the string
            const hash = key % this.size;

            // Add the key hash to the buckets
            if (!bucketsMap.has(hash)) {
                bucketsMap.set(hash, []);
            }

            // Map key position with hash
            bucketsMap.get(hash)!.push(cursor);
            cursor += 1;
        });

        // Reserve space for 'undefined' value
        cursor = 1;

        const buckets: number[] = [];

        bucketsMap.forEach((value, key) => {
            const position = cursor;
            buckets[cursor] = value.length;
            cursor += 1;

            value.forEach((element) => {
                buckets[cursor] = element;
                cursor += 1;
            });

            // Map bucket position with hash
            this.lookupIndex[key] = position;
        });

        this.buckets = new Uint32Array(buckets);
    }

    public get(input: number): number | undefined {
        // Get the bucket position
        const hash = input % this.size;
        const bucketPosition = this.lookupIndex[hash];

        // If the bucket position is empty, data is not found
        if (bucketPosition === BinaryMap.EMPTY_POSITION) {
            return undefined;
        }

        // Get the bucket
        const bucketLength = this.buckets[bucketPosition];

        let cursor = bucketPosition + 1;
        const endOfBucket = cursor + bucketLength;

        while (cursor < endOfBucket) {
            const keyPosition = this.buckets[cursor];
            const key = this.keys[keyPosition];

            if (key === input) {
                return this.values[keyPosition];
            }

            cursor += 1;
        }

        return undefined;
    }
}
