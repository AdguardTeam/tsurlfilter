export const enum StorageKeys {
    IsStarted = 'isStarted',
    Config = 'config',
}

class Storage {
    private storage;

    constructor(storage: chrome.storage.LocalStorageArea) {
        this.storage = storage;
    }

    get = <T>(key: string): Promise<T | undefined> => {
        return new Promise((resolve, reject) => {
            this.storage.get([key], (result: { [x: string]: T }) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                }
                resolve(result[key]);
            });
        });
    };

    // TODO: Add throttle
    set = (key: string, value: unknown): Promise<void> => {
        return new Promise((resolve, reject) => {
            this.storage.set({ [key]: value }, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                }
                resolve();
            });
        });
    };
}

export const storage = new Storage(chrome.storage.local);
