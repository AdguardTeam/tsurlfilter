import { PersistentValueContainer } from './persistent-value-container';
import type { ExtendedStorageInterface } from './core/storage-interface';

/**
 * API for storing persistent key-value data with debounced sync using a specified storage key.
 * Storage synchronization is described in the {@link PersistentValueContainer} class.
 */
export class ExtensionStorage<
    Data extends Record<string, unknown>,
    Key extends string = string,
> {
    /**
     * API for storing persistent value with debounced sync using the specified storage key.
     */
    #container: PersistentValueContainer<Key, Data>;

    /**
     * Creates {@link ExtensionStorage} instance.
     * @param key The key to use for storing the data.
     * @param storage Storage interface implementation (replacing WebExtension API storage).
     */
    constructor(
        key: Key,
        storage: ExtendedStorageInterface<Key, Data, 'async'>, // Use StorageInterface for async storage handling
    ) {
        this.#container = new PersistentValueContainer<Key, Data>(key, storage);
    }

    /**
     * Initializes the storage.
     * @param data The initial data.
     * @returns Promise that resolves when the storage is initialized.
     * @throws Error, if storage already initialized.
     */
    init(data: Data): Promise<void> {
        return this.#container.init(data);
    }

    /**
     * Gets the value by the specified key.
     * @param key The key to retrieve the value.
     * @throws Error, if storage not initialized.
     * @returns The data stored by the specified key.
     */
    get<T extends keyof Data>(key: T): Data[T] {
        return this.#container.get()[key];
    }

    /**
     * Sets the value by the specified key.
     * @param key The key for the value to be stored.
     * @param value The new value.
     * @throws Error, if storage not initialized.
     */
    set<T extends keyof Data>(key: T, value: Data[T]): void {
        const data = this.#container.get();
        data[key] = value;
        this.#container.set(data);
    }

    /**
     * Deletes the value by the specified key.
     * @param key The key for the value to be deleted.
     * @throws Error, if storage not initialized.
     */
    delete(key: keyof Data): void {
        const data = this.#container.get();
        delete data[key];
        this.#container.set(data);
    }
}
