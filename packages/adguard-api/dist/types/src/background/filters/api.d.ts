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
import { Logger } from "../logger";
/**
 * Filter Api provides methods for managing filters data
 */
export declare class FiltersApi {
    private metadataApi;
    private versionsApi;
    private filterRulesApi;
    private network;
    private logger;
    constructor(network: Network, storage: Storage, logger: Logger);
    /**
     * Initializes linked APIs
     */
    init(): Promise<void>;
    /**
     * Gets filter rules lists for specified filters ids.
     *
     * @param filterIds - list of filter ids
     * @returns filters data for {@link TsWebExtension} configuration
     */
    getFilters(filterIds: number[]): Promise<{
        content: string;
        filterId: number;
        trusted: boolean;
    }[]>;
    /**
     * Gets filter rules for specified filter id.
     *
     * Try to load rules from extension storage.
     * If rules is not found, download it from backend.
     *
     * @param filterId - filter id
     * @returns filters data item for {@link TsWebExtension} configuration
     */
    private getFilter;
    /**
     * Update filters rules lists based on {@link FilterMetadata}.
     *
     * Downloads fresh {@link Metadata} from backend
     * and match filter versions with persisted {@link FilterVersionStorageData} for each installed filter.
     * If filter version in metadata is higher, downloads and saves new rules content
     *
     * Dispatches {@link NotifierEventType.UpdateFilters} event, if at least one filter has been updated
     */
    updateFilters(): Promise<void>;
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
    private updateFilter;
    /**
     * Checks if filter need update.
     * Matches version from updated metadata with data in filter version storage.
     *
     * @param filterMetadata - updated filter metadata
     * @returns true, if filter update is required, else returns false.
     */
    private isFilterNeedUpdate;
    /**
     * Download filter rules from backend
     *
     * @param filterId - filter Id
     * @returns list of downloaded rules lines
     */
    private loadFilterRules;
    /**
     * Gets list of filters for the specified language
     *
     * @param locale - page locale
     * @returns list of filters ids for the specified language
     */
    getFilterIdsForLanguage(locale: string): number[];
}
