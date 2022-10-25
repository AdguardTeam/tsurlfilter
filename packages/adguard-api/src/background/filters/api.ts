import { Network, FilterMetadata } from "../network";
import { Storage } from "../storage";
import { MetadataApi } from "./metadata";
import { VersionsApi } from "./versions";
import { FilterRulesApi } from "./rules";
import { BrowserUtils } from "../utils";

export class FiltersApi {
    private metadataApi: MetadataApi;

    private versionsApi: VersionsApi;

    private filterRulesApi: FilterRulesApi;

    private network: Network;

    constructor(network: Network, storage: Storage) {
        this.metadataApi = new MetadataApi(network, storage);
        this.versionsApi = new VersionsApi(storage);
        this.filterRulesApi = new FilterRulesApi(storage);
        this.network = network;
    }

    public async init(): Promise<void> {
        await this.metadataApi.init();
        await this.versionsApi.init();
    }

    public async getFilters(filterIds: number[]): Promise<
        {
            content: string;
            filterId: number;
            trusted: boolean;
        }[]
    > {
        const tasks = filterIds.map((id) => this.getFilter(id));

        return Promise.all(tasks);
    }

    private async getFilter(filterId: number): Promise<{
        content: string;
        filterId: number;
        trusted: boolean;
    }> {
        let rules = await this.filterRulesApi.get(filterId);

        if (!Array.isArray(rules)) {
            rules = await this.loadFilterRules(filterId);
        }

        return {
            filterId,
            content: (rules || []).join("\n"),
            trusted: true,
        };
    }

    /**
     * Update filters
     */
    public async updateFilters(): Promise<void> {
        // eslint-disable-next-line no-console
        console.log("Update filters");
        /**
         * Reload filters metadata from backend for correct
         * version matching on update check.
         */
        await this.metadataApi.loadMetadata();

        const ids = this.versionsApi.getInstalledFilters();

        const updateTasks = ids.map(async (id) => this.updateFilter(id));

        await Promise.allSettled(updateTasks);
    }

    /**
     * Update filter
     *
     * @param filterId - filter id
     * @returns updated filter metadata or null, if update is not required
     */
    private async updateFilter(filterId: number): Promise<FilterMetadata | null> {
        /* eslint-disable no-console */
        console.log(`Update filter ${filterId}`);

        const filterMetadata = this.metadataApi.getFilterMetadata(filterId);

        if (!filterMetadata) {
            console.error(`Can't find filter ${filterId} metadata`);
            return null;
        }

        if (!this.isFilterNeedUpdate(filterMetadata)) {
            console.log(`Filter ${filterId} is already updated`);
            return null;
        }

        try {
            await this.loadFilterRules(filterId);
            console.log(`Successfully update filter ${filterId}`);
            return filterMetadata;
        } catch (e) {
            console.error(e);
            return null;
        }
        /* eslint-enable no-console */
    }

    /**
     * Checks if common filter need update.
     * Matches version from updated metadata with data in filter version storage.
     *
     * @param filterMetadata - updated filter metadata
     * @returns true, if filter update is required, else returns false.
     */
    private isFilterNeedUpdate(filterMetadata: FilterMetadata): boolean {
        // eslint-disable-next-line no-console
        console.log(`Check if filter ${filterMetadata.filterId} need to update`);

        const filterVersion = this.versionsApi.get(filterMetadata.filterId);

        // filter is not installed
        if (!filterVersion) {
            return false;
        }

        return !BrowserUtils.isGreaterOrEqualsVersion(filterVersion.version, filterMetadata.version);
    }

    private async loadFilterRules(filterId: number): Promise<string[]> {
        // eslint-disable-next-line no-console
        console.log(`Download ${filterId} rules`);

        const filterMetadata = this.metadataApi.getFilterMetadata(filterId);

        if (!filterMetadata) {
            throw new Error(`filter ${filterId} metadata is not found`);
        }

        const rules = await this.network.downloadFilterRules(filterId);
        await this.filterRulesApi.set(filterId, rules);

        const { version, expires, timeUpdated } = filterMetadata;

        this.versionsApi.set(filterId, {
            version,
            expires,
            lastUpdateTime: new Date(timeUpdated).getTime(),
            lastCheckTime: Date.now(),
        });

        return rules;
    }
}
