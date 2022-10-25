import { Storage } from "../storage";

export type FilterVersionData = {
    version: string;
    lastCheckTime: number;
    lastUpdateTime: number;
    expires: number;
};

export type FilterVersionStorageData = Record<number, FilterVersionData>;

export class VersionsApi {
    private versions: FilterVersionStorageData | undefined;

    private storage: Storage;

    constructor(storage: Storage) {
        this.storage = storage;
    }

    public async init(): Promise<void> {
        const storageData = await this.storage.get("versions");

        if (typeof storageData !== "string") {
            this.loadDefaultData();
            return;
        }

        try {
            this.versions = JSON.parse(storageData);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("Can`t parse data from versions storage, load default data");
            this.loadDefaultData();
        }
    }

    public getInstalledFilters(): number[] {
        if (!this.versions) {
            throw new Error("Filter versions is not initialized");
        }
        return Object.keys(this.versions).map((id) => Number(id));
    }

    public get(filterId: number): FilterVersionData {
        if (!this.versions) {
            throw new Error("Filter versions is not initialized");
        }

        return this.versions[filterId];
    }

    public async set(filterId: number, data: FilterVersionData): Promise<void> {
        if (!this.versions) {
            throw new Error("Filter versions is not initialized");
        }

        this.versions[filterId] = data;
        await this.saveData();
    }

    private async saveData(): Promise<void> {
        await this.storage.set("versions", JSON.stringify(this.versions));
    }

    private async loadDefaultData(): Promise<void> {
        this.versions = {};
        await this.saveData();
    }
}
