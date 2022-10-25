import { Storage } from "../storage";

export class FilterRulesApi {
    storage: Storage;

    constructor(storage: Storage) {
        this.storage = storage;
    }

    async get(filterId: number): Promise<string[] | undefined> {
        return this.storage.get(FilterRulesApi.getFilterKey(filterId)) as Promise<string[] | undefined>;
    }

    async set(filterId: number, rules: string[]): Promise<void> {
        await this.storage.set(FilterRulesApi.getFilterKey(filterId), rules);
    }

    private static getFilterKey(filterId: number): string {
        return `filterrules_${filterId}.txt`;
    }
}
