/**
 * @file Simple storage implementation for testing.
 */

import { type Storage } from '../../src/utils/storage-interface.js';

/**
 * Represents a very simple storage implementation.
 *
 * @note Handling storage is not a scope of the AGTree library,
 * this is just a simple implementation for testing purposes.
 */
export class SimpleStorage implements Storage {
    private storage: Map<string, unknown> = new Map();

    /**
     * Writes the specified value to the storage associated with the specified key.
     *
     * @param key The key to write the value for.
     * @param value The value to write.
     * @returns A promise that resolves when the value is successfully written to the storage.
     */
    public async set(key: string, value: unknown): Promise<void> {
        // practically, storage makes a deep copy of the value, so we do the same here
        this.storage.set(key, structuredClone(value));
    }

    /**
     * Reads the value associated with the specified key from the storage.
     *
     * @param key The key to read the value for.
     * @returns A promise that resolves to the value associated with the key, or an empty array if the key is not found.
     */
    public async get(key: string): Promise<unknown | undefined> {
        return this.storage.get(key);
    }
}
