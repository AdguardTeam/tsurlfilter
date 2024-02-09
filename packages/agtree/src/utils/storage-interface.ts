/**
 * @file Represents a storage interface for reading and writing data.
 */

/**
 * Represents a storage interface for reading and writing data.
 */
export interface Storage {
    /**
     * Writes the given chunks of data to the storage with the specified key.
     *
     * @param key - The key to identify the data in the storage.
     * @param chunks - An array of Uint8Array chunks to be written.
     * @returns A promise that resolves when the write operation is complete.
     */
    write(key: string, chunks: Uint8Array[]): Promise<void>;

    /**
     * Reads the data from the storage with the specified key.
     *
     * @param key - The key to identify the data in the storage.
     * @returns A promise that resolves with an array of Uint8Array chunks representing the data.
     */
    read(key: string): Promise<Uint8Array[]>;
}
