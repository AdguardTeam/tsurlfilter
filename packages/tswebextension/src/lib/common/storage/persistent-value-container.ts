import { debounce } from 'lodash-es';
import browser, { type Storage, type Manifest } from 'webextension-polyfill';

/**
 * API to store a persistent value with debounced synchronization to the specified web extension storage key.
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
    // TODO: delete after the migration to event-driven background.
    // We do not recalculate this value because the background type cannot change at runtime.
    static #IS_BACKGROUND_PERSISTENT = PersistentValueContainer.#isBackgroundPersistent();

    #api: Storage.StorageArea;

    #key: Key;

    #value!: Value;

    // TODO: make required after the migration to event-driven background.
    #save?: () => void;

    #isInitialized = false;

    /**
     * Creates {@link PersistentValueContainer} instance.
     * @param key The key to use for storing the data.
     * @param api Webextension storage API.
     * @param debounceMs The debounce time in milliseconds to save the data to the storage.
     * Optional. Default is 300ms.
     */
    constructor(
        key: Key,
        api: Storage.StorageArea,
        debounceMs = 300,
    ) {
        this.#key = key;
        this.#api = api;

        /**
         * TODO: remove this condition after the migration to event-driven background.
         */
        if (!PersistentValueContainer.#IS_BACKGROUND_PERSISTENT) {
            this.#save = debounce(() => {
                this.#api.set({ [this.#key]: this.#value });
            }, debounceMs);
        }
    }

    /**
     * Initializes the value.
     * @param value The initial value.
     * @returns Promise that resolves when the value is initialized.
     * @throws Error, if storage already initialized.
     */
    async init(value: Value): Promise<void> {
        if (this.#isInitialized) {
            throw new Error('Storage already initialized');
        }

        if (PersistentValueContainer.#IS_BACKGROUND_PERSISTENT) {
            this.#value = value;
        } else {
            const storageData = await this.#api.get({
                [this.#key]: value,
            });

            this.#value = storageData[this.#key];
        }

        this.#isInitialized = true;
    }

    /**
     * Gets the value.
     * @returns The value stored by the specified key.
     * @throws Error, if storage not initialized.
     */
    get(): Value {
        this.#checkIsInitialized();

        return this.#value;
    }

    /**
     * Sets the value.
     * @param value Value to be stored in the specified key.
     * @throws Error, if storage not initialized.
     */
    set(value: Value): void {
        this.#checkIsInitialized();

        this.#value = value;

        if (this.#save) {
            this.#save();
        }
    }

    /**
     * Checks if the storage is initialized.
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
