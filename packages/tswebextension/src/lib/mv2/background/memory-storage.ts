import { pick, merge } from 'lodash-es';
import type { Events, Storage } from 'webextension-polyfill';

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
    clear(): Promise<void> {
        this.data = {};
        return Promise.resolve();
    }
}
