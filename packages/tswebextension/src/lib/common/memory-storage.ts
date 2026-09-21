import { merge, pick } from 'lodash-es';
import { type Events, type Storage } from 'webextension-polyfill';

/**
 * Memory storage that implements the StorageArea interface.
 */
export class MemoryStorage implements Storage.StorageArea {
    private data: Record<string, unknown>;

    // TODO: implement
    declare onChanged: Events.Event<(changes: Storage.StorageAreaOnChangedChangesType) => void>;

    /** @inheritdoc */
    constructor(initData: Record<string, unknown> = {}) {
        this.data = initData;
    }

    /** @inheritdoc */
    get(keys?: string | string[] | Record<string, unknown> | null | undefined): Promise<Record<string, unknown>> {
        if (keys === undefined || keys === null) {
            return Promise.resolve(this.data);
        }

        if (typeof keys === 'string') {
            return Promise.resolve({ [keys]: this.data[keys] });
        }

        if (Array.isArray(keys)) {
            return Promise.resolve(pick(this.data, keys));
        }

        if (typeof keys === 'object') {
            const picked = Object.keys(keys);
            this.data = merge(keys, this.data);
            return Promise.resolve(pick(this.data, picked));
        }

        return Promise.resolve({});
    }

    /** @inheritdoc */
    set(items: Record<string, unknown>): Promise<void> {
        Object.assign(this.data, items);
        return Promise.resolve();
    }

    /** @inheritdoc */
    remove(keys: string | string[]): Promise<void> {
        if (typeof keys === 'string') {
            delete this.data[keys];
        } else {
            keys.forEach((key) => {
                delete this.data[key];
            });
        }

        return Promise.resolve();
    }

    /** @inheritdoc */
    getBytesInUse(keys?: null | string | string[]): Promise<number> {
        // Rough estimate: JSON-serialized size in bytes (UTF-16 code units
        // are a good enough approximation for an in-memory shim).
        const sizeOf = (value: unknown): number => JSON.stringify(value)?.length ?? 0;

        if (keys === undefined || keys === null) {
            return Promise.resolve(sizeOf(this.data));
        }

        const keyList = typeof keys === 'string' ? [keys] : keys;

        return Promise.resolve(
            keyList.reduce((total, key) => total + sizeOf({ [key]: this.data[key] }), 0),
        );
    }

    /** @inheritdoc */
    getKeys(): Promise<string[]> {
        return Promise.resolve(Object.keys(this.data));
    }

    /** @inheritdoc */
    clear(): Promise<void> {
        this.data = {};
        return Promise.resolve();
    }
}
