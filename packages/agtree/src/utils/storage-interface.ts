/**
 * @file Represents a storage interface for reading and writing data.
 */

/**
 * Represents a storage interface for reading and writing data.
 */
export interface Storage<K = string, V = unknown> {
    /**
     * Writes the given data to the storage with the specified key.
     *
     * @param key The key to identify the data in the storage.
     * @param chunks The data to write to the storage.
     * @returns A promise that resolves when the write operation is complete.
     */
    set(key: K, data: V): Promise<void>;

    /**
     * Reads the data from the storage with the specified key.
     *
     * @param key The key to identify the data in the storage.
     * @returns A promise that resolves with the data read from the storage.
     */
    get(key: K): Promise<V | undefined>;
}
