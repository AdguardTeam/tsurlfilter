import { debounce } from 'lodash-es';
import browser, { type Manifest } from 'webextension-polyfill';

import { type ExtendedStorageInterface } from './core/storage-interface';

/**
 * API to store a persistent value with debounced synchronization to the specified storage key.
 *
 * After the container is created, we initialize it asynchronously to get the actual value from the storage.
 * The Init method is guarded against multiple initializations to avoid unnecessary reads from the memory.
 * Get/set methods are protected from uninitialized storage to ensure that actual data is used.
 *
 * We declare the sync get/set methods to update the cached value. This allows us to use containers in accessors.
 *
 * Set method updates the cached value and schedules the save operation to the storage via a debounce function to
 * avoid unnecessary writes to the storage.
 *
 * This container saves the data to storage using the specified key to avoid collisions with other instances.
 * It helps to avoid reading the data from the storage that is not related to the current instance.
 */
export class PersistentValueContainer<Key extends string = string, Value = unknown> {
    static #IS_BACKGROUND_PERSISTENT = PersistentValueContainer.#isBackgroundPersistent();

    #storage: ExtendedStorageInterface<Key, Value, 'async'>; // Using the async StorageInterface

    #key: Key;

    #value!: Value;

    #save!: () => void;

    #isInitialized = false;

    /**
     * Creates {@link PersistentValueContainer} instance.
     *
     * @param key The key to use for storing the data.
     * @param storage The storage interface implementation.
     * @param debounceMs The debounce time in milliseconds to save the data to the storage.
     * Optional. Default is 300ms.
     */
    constructor(
        key: Key,
        storage: ExtendedStorageInterface<Key, Value, 'async'>, // Accepts a StorageInterface implementation
        debounceMs = 300,
    ) {
        this.#key = key;
        this.#storage = storage;

        // Configure the #save method to decide dynamically between debounce or direct call
        this.#save = PersistentValueContainer.#IS_BACKGROUND_PERSISTENT
            ? (): void => {
                this.#storage.set(this.#key, this.#value); // Save directly
            }
            : debounce(() => {
                this.#storage.set(this.#key, this.#value); // Save using debounce
            }, debounceMs);
    }

    /**
     * Initializes the value.
     *
     * @param value The initial value.
     *
     * @returns Promise that resolves when the value is initialized.
     *
     * @throws Error, if storage already initialized.
     */
    async init(value: Value): Promise<void> {
        if (this.#isInitialized) {
            throw new Error('Storage already initialized');
        }

        if (PersistentValueContainer.#IS_BACKGROUND_PERSISTENT) {
            this.#value = value;
        } else {
            const storedValue = await this.#storage.get(this.#key);

            this.#value = storedValue !== undefined ? storedValue : value; // Use stored value or fallback to default
        }

        this.#isInitialized = true;
    }

    /**
     * Gets the value.
     *
     * @returns The value stored by the specified key.
     *
     * @throws Error, if storage not initialized.
     */
    get(): Value {
        this.#checkIsInitialized();
        return this.#value;
    }

    /**
     * Sets the value.
     *
     * @param value Value to be stored in the specified key.
     *
     * @throws Error, if storage not initialized.
     */
    set(value: Value): void {
        this.#checkIsInitialized();
        this.#value = value;

        this.#save();
    }

    /**
     * Checks if the storage is initialized.
     *
     * @throws Error, if storage not initialized.
     */
    #checkIsInitialized(): void {
        if (!this.#isInitialized) {
            throw new Error('Storage not initialized');
        }
    }

    /**
     * TODO: remove this method after the migration to event-driven background.
     * Checks if the background script is persistent.
     *
     * @returns True if the background script is persistent.
     */
    static #isBackgroundPersistent(): boolean {
        const manifest = browser.runtime.getManifest();

        if (manifest.manifest_version === 3) {
            return false;
        }

        if (!manifest.background) {
            return true;
        }

        const background = manifest.background as
            (Manifest.WebExtensionManifestBackgroundC2Type | Manifest.WebExtensionManifestBackgroundC1Type);

        return background.persistent ?? true;
    }
}
