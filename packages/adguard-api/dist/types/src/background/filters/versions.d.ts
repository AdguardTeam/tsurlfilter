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
import { Storage } from "../storage";
import { FilterVersionData } from "../schemas";
import { Logger } from "../logger";
export declare const FILTERS_VERSIONS_KEY = "versions";
/**
 * Api for managing filter version data
 */
export declare class VersionsApi {
    private versions;
    private storage;
    private logger;
    constructor(storage: Storage, logger: Logger);
    /**
     * Reads and parses {@link FilterVersionStorageData} from extension storage.
     *
     * If data is invalid or not exist, load default data
     */
    init(): Promise<void>;
    /**
     * Gets installed filters ids.
     *
     * A filter is considered installed if its version data is saved
     *
     * @returns list of filters ids
     * @throws error if filter version storage data is not loaded
     */
    getInstalledFilters(): number[];
    /**
     * Gets version data for specified filter
     *
     * @param filterId - filter id
     * @returns filter version data
     * @throws error if filter version storage data is not loaded
     */
    get(filterId: number): FilterVersionData | undefined;
    /**
     * Sets version data for specified filter
     *
     * @param filterId - filter id
     * @param data - filter version data
     * @throws error if filter version storage data is not loaded
     */
    set(filterId: number, data: FilterVersionData): Promise<void>;
    /**
     * Save data in extension storage
     */
    private saveData;
    /**
     * Load default empty filter storage data
     */
    private loadDefaultData;
}
