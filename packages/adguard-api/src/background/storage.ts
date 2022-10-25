import browser from "webextension-polyfill";

export class Storage {
    private storage = browser.storage.local;

    public async set(key: string, value: unknown): Promise<void> {
        await this.storage.set({ [key]: value });
    }

    public async get(key: string): Promise<unknown> {
        return (await this.storage.get(key))?.[key];
    }

    public async remove(key: string): Promise<void> {
        await this.storage.remove(key);
    }
}
