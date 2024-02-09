import { type Storage } from '../../src/utils/storage-interface';

/**
 * Represents a simple storage implementation that stores Uint8Array arrays.
 *
 * @note Storage is not implemented in AGTree, but we need this simple implementation for testing.
 */
export class SimpleStorage implements Storage<Uint8Array[]> {
    private storage: { [key: string]: Uint8Array[] } = {};

    /**
     * Reads the value associated with the specified key from the storage.
     *
     * @param key The key to read the value for.
     * @returns A promise that resolves to the value associated with the key, or an empty array if the key is not found.
     */
    public async read(key: string): Promise<Uint8Array[]> {
        return this.storage[key] ?? [];
    }

    /**
     * Writes the specified value to the storage associated with the specified key.
     *
     * @param key The key to write the value for.
     * @param value The value to write.
     * @returns A promise that resolves when the value is successfully written to the storage.
     */
    public async write(key: string, value: Uint8Array[]): Promise<void> {
        this.storage[key] = value;
    }
}
