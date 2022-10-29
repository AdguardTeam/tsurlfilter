/**
 * @file
 * This file is part of Adguard API library (https://github.com/AdguardTeam/tsurlfilter/packages/adguard-api).
 *
 * Adguard API is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard API is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adguard API. If not, see <http://www.gnu.org/licenses/>.
 */
import { Network } from "../network";
import { Storage } from "../storage";
import { MetadataApi } from "./metadata";
import { VersionsApi } from "./versions";
import { FilterRulesApi } from "./rules";
import { BrowserUtils, I18n } from "../utils";
import { FilterMetadata } from "../schemas";
import { notifier, NotifierEventType } from "../notifier";

/**
 * Filter Api provides methods for managing filters data
 */
export class FiltersApi {
    // Api for managing app Metadata
    private metadataApi: MetadataApi;

    // Api for managing filter version data
    private versionsApi: VersionsApi;

    // Api for write and read filters rules from extension storage
    private filterRulesApi: FilterRulesApi;

    // Network requests API
    private network: Network;

    constructor(network: Network, storage: Storage) {
        this.metadataApi = new MetadataApi(network, storage);
        this.versionsApi = new VersionsApi(storage);
        this.filterRulesApi = new FilterRulesApi(storage);
        this.network = network;
    }

    /**
     * Initializes linked APIs
     */
    public async init(): Promise<void> {
        await this.metadataApi.init();
        await this.versionsApi.init();
    }

    /**
     * Gets filter rules lists for specified filters ids.
     *
     * @param filterIds - list of filter ids
     * @returns filters data for {@link TsWebExtension} configuration
     */
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

    /**
     * Gets filter rules for specified filter id.
     *
     * Try to load rules from extension storage.
     * If rules is not found, download it from backend.
     *
     * @param filterId - filter id
     * @returns filters data item for {@link TsWebExtension} configuration
     */
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
     * Update filters rules lists based on {@link FilterMetadata}.
     *
     * Downloads fresh {@link Metadata} from backend
     * and match filter versions with persisted {@link FilterVersionStorageData} for each installed filter.
     * If filter version in metadata is higher, downloads and saves new rules content
     *
     * Dispatches {@link NotifierEventType.UpdateFilters} event, if at least one filter has been updated
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

        const updatedFilters = await Promise.all(updateTasks);

        if (updatedFilters.some((filterData) => !!filterData?.filterId)) {
            notifier.publishEvent({ type: NotifierEventType.UpdateFilters });
        }
    }

    /**
     * Update filter rules list based on {@link FilterMetadata}
     *
     * Match filter version from {@link Metadata} with persisted filter version from {@link VersionsApi}.
     * If version in metadata is higher, downloads and saves new filter rules.
     *
     * Note: you must update {@link Metadata} first.
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
     * Checks if filter need update.
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

    /**
     * Download filter rules from backend
     *
     * @param filterId - filter Id
     * @returns list of downloaded rules lines
     */
    private async loadFilterRules(filterId: number): Promise<string[]> {
        // eslint-disable-next-line no-console
        console.log(`Download rules for filter ${filterId}`);

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

    /**
     * Gets list of filters for the specified language
     *
     * @param locale - page locale
     * @returns list of filters ids for the specified language
     */
    public getFilterIdsForLanguage(locale: string): number[] {
        const filters = this.metadataApi.getFiltersMetadata();

        const filterIds: number[] = [];
        for (let i = 0; i < filters.length; i += 1) {
            const filter = filters[i];
            const { languages } = filter;
            if (languages && languages.length > 0) {
                const language = I18n.find(languages, locale);
                if (language) {
                    filterIds.push(filter.filterId);
                }
            }
        }
        return filterIds;
    }
}
