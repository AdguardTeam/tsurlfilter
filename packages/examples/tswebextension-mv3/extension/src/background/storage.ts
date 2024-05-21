import browser from 'webextension-polyfill';

export const enum StorageKeys {
    IsStarted = 'isStarted',
    Config = 'config',
}

class Storage {
    private storage;

    constructor(storage: browser.Storage.LocalStorageArea) {
        this.storage = storage;
    }

    get = async <T>(key: string): Promise<T | undefined> => {
        const result = await this.storage.get([key]);
        return result[key];
    };

    // TODO: Add throttle
    set = async (key: string, value: unknown): Promise<void> => {
        await this.storage.set({ [key]: value });
    };
}

export const storage = new Storage(browser.storage.local);
