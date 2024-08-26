import browser from 'webextension-polyfill';

// TODO: change example to IndexedDB, because it's more suitable for this case
export const enum StorageKeys {
    IsStarted = 'isStarted',
    Config = 'config',
}

class Storage {
    private storage;

    constructor(storage: browser.Storage.LocalStorageArea) {
        this.storage = storage;
    }

    /**
     * Helper function to serialize Uint8Array members of an object.
     * This workaround is needed because by default chrome.storage API doesn't support Uint8Array,
     * and we use it to store serialized filter lists.
     *
     * @param value Object to serialize.
     *
     * @returns Serialized object.
     */
    private serialize = (value: unknown): unknown => {
        if (value instanceof Uint8Array) {
            return { __type: 'Uint8Array', data: Array.from(value) };
        } else if (Array.isArray(value)) {
            return value.map(this.serialize);
        } else if (value && typeof value === 'object') {
            const serializedObject: { [key: string]: unknown } = {};
            for (const [key, val] of Object.entries(value)) {
                serializedObject[key] = this.serialize(val);
            }
            return serializedObject;
        }
        return value;
    };

    /**
     * Helper function to deserialize Uint8Array members of an object.
     * This workaround is needed because by default chrome.storage API doesn't support Uint8Array,
     * and we use it to store serialized filter lists.
     *
     * @param value Object to deserialize.
     * @returns Deserialized object.
     */
    private deserialize = (value: unknown): unknown => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (value && typeof value === 'object' && (value as any).__type === 'Uint8Array') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return new Uint8Array((value as any).data);
        } else if (Array.isArray(value)) {
            return value.map(this.deserialize);
        } else if (value && typeof value === 'object') {
            const deserializedObject: { [key: string]: unknown } = {};
            for (const [key, val] of Object.entries(value)) {
                deserializedObject[key] = this.deserialize(val);
            }
            return deserializedObject;
        }
        return value;
    };

    get = <T>(key: string): Promise<T | undefined> => {
        return new Promise((resolve, reject) => {
            this.storage.get([key]).then((result: { [x: string]: T }) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                }
                resolve(this.deserialize(result[key]) as T);
            });
        });
    };

    // TODO: Add throttle
    set = (key: string, value: unknown): Promise<void> => {
        return new Promise((resolve, reject) => {
            const serializedValue = this.serialize(value);
            this.storage.set({ [key]: serializedValue }).then(() => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                }
                resolve();
            });
        });
    };
}

export const storage = new Storage(browser.storage.local);
