/**
 * @file Memory storage implementation with async operations.
 */

import { cloneDeep } from 'lodash-es';

import { logger } from '../../utils/logger';

import { type ExtendedStorageInterface } from './storage-interface';

/**
 * Provides a simple in-memory storage implementation.
 * This class implements the ExtendedStorageInterface with asynchronous methods.
 *
 * @template Data The type of the value stored in the storage.
 */
export class MemoryStorage<Data = unknown> implements ExtendedStorageInterface<string, Data, 'async'> {
    /**
     * Internal map to hold the key-value pairs.
     */
    private store: Map<string, Data>;

    /**
     * Constructs an instance of the MemoryStorage class.
     */
    constructor() {
        this.store = new Map<string, Data>();
    }

    /**
     * Retrieves a value by key from the storage.
     *
     * @param key The key of the value to retrieve.
     *
     * @returns A promise that resolves with the value associated with the key.
     */
    public async get(key: string): Promise<Data | undefined> {
        return Promise.resolve(this.store.get(key));
    }

    /**
     * Sets a value in the storage with the specified key.
     *
     * @param key The key under which to store the value.
     * @param value The value to store.
     *
     * @returns A promise that resolves when the operation is complete.
     */
    public async set(key: string, value: Data): Promise<void> {
        this.store.set(key, cloneDeep(value));
        return Promise.resolve();
    }

    /**
     * Removes a value from the storage by key.
     *
     * @param key The key of the value to remove.
     *
     * @returns A promise that resolves when the operation is complete.
     */
    public async remove(key: string): Promise<void> {
        this.store.delete(key);
        return Promise.resolve();
    }

    /**
     * Sets multiple key-value pairs in the storage.
     *
     * @param data The key-value pairs to set.
     *
     * @returns A promise that resolves with true if all operations were successful.
     */
    public async setMultiple(data: Record<string, Data>): Promise<boolean> {
        try {
            // Create a deep copy of each value
            const clonedData = cloneDeep(data);

            // Set each key-value pair into the store using Object.assign
            Object.assign(
                this.store,
                Object.entries(clonedData).reduce((acc, [key, value]) => {
                    acc[key] = value as Data;
                    return acc;
                }, {} as Record<string, Data>),
            );

            return await Promise.resolve(true);
        } catch (error) {
            logger.error('[tsweb.MemoryStorage.setMultiple]: error in setMultiple: ', error);
            return Promise.resolve(false);
        }
    }

    /**
     * Removes multiple key-value pairs from the storage.
     *
     * @param keys The keys to remove.
     *
     * @returns A promise that resolves with true if all operations were successful.
     */
    public async removeMultiple(keys: string[]): Promise<boolean> {
        try {
            keys.forEach((key) => this.store.delete(key));
            return await Promise.resolve(true);
        } catch (error) {
            logger.error('[tsweb.MemoryStorage.removeMultiple]: error in removeMultiple: ', error);
            return Promise.resolve(false);
        }
    }

    /**
     * Retrieves all entries in the storage.
     *
     * @returns A promise that resolves with an object containing all key-value pairs in the storage.
     */
    public async entries(): Promise<Record<string, Data>> {
        return Promise.resolve(Object.fromEntries(this.store.entries()));
    }

    /**
     * Retrieves all keys in the storage.
     *
     * @returns A promise that resolves with an array of all keys in the storage.
     */
    public async keys(): Promise<string[]> {
        return Promise.resolve(Array.from(this.store.keys()));
    }

    /**
     * Checks if a key exists in the storage.
     *
     * @param key The key to check.
     *
     * @returns A promise that resolves with true if the key exists, false otherwise.
     */
    public async has(key: string): Promise<boolean> {
        return Promise.resolve(this.store.has(key));
    }

    /**
     * Clears the storage.
     *
     * @returns A promise that resolves when the storage is cleared.
     */
    public async clear(): Promise<void> {
        this.store.clear();
        return Promise.resolve();
    }
}
