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

import { Storage } from '../storage';
import { filterVersionStorageDataValidator, FilterVersionData, FilterVersionStorageData } from '../schemas';
import { Logger } from '../logger';

// Filters versions data storage key for browser.storage.local
export const FILTERS_VERSIONS_KEY = 'versions';

/**
 * Api for managing filter version data
 */
export class VersionsApi {
    // Cached filter version data
    private versions: FilterVersionStorageData | undefined;

    // Dev-friendly API for key-value extension storage
    private storage: Storage;

    // Simple Api for logging
    private logger: Logger;

    constructor(storage: Storage, logger: Logger) {
        this.logger = logger;
        this.storage = storage;
    }

    /**
     * Reads and parses {@link FilterVersionStorageData} from extension storage.
     *
     * If data is invalid or not exist, load default data
     */
    public async init(): Promise<void> {
        const storageData = await this.storage.get(FILTERS_VERSIONS_KEY);

        if (typeof storageData !== 'string') {
            this.loadDefaultData();
            return;
        }

        try {
            const versions = JSON.parse(storageData);
            this.versions = filterVersionStorageDataValidator.parse(versions);
        } catch (e) {
            this.logger.warn('Can`t parse data from versions storage, load default data', e);
            this.loadDefaultData();
        }
    }

    /**
     * Gets installed filters ids.
     *
     * A filter is considered installed if its version data is saved
     *
     * @returns list of filters ids
     * @throws error if filter version storage data is not loaded
     */
    public getInstalledFilters(): number[] {
        if (!this.versions) {
            throw new Error('Filter versions are not initialized');
        }
        return Object.keys(this.versions).map((id) => Number(id));
    }

    /**
     * Gets version data for specified filter
     *
     * @param filterId - filter id
     * @returns filter version data
     * @throws error if filter version storage data is not loaded
     */
    public get(filterId: number): FilterVersionData | undefined {
        if (!this.versions) {
            throw new Error('Filter versions are not initialized');
        }

        return this.versions[filterId];
    }

    /**
     * Sets version data for specified filter
     *
     * @param filterId - filter id
     * @param data - filter version data
     * @throws error if filter version storage data is not loaded
     */
    public async set(filterId: number, data: FilterVersionData): Promise<void> {
        if (!this.versions) {
            throw new Error('Filter versions are not initialized');
        }

        this.versions[filterId] = data;
        await this.saveData();
    }

    /**
     * Deletes specified filter version.
     *
     * @param filterId Filter id.
     * @throws Error if filter version data is not initialized.
     */
    public async delete(filterId: number): Promise<void> {
        if (!this.versions) {
            throw new Error('Filter versions are not initialized');
        }

        delete this.versions[filterId];

        await this.saveData();
    }

    /**
     * Save data in extension storage
     */
    private async saveData(): Promise<void> {
        await this.storage.set(FILTERS_VERSIONS_KEY, JSON.stringify(this.versions));
    }

    /**
     * Load default empty filter storage data
     */
    private async loadDefaultData(): Promise<void> {
        this.versions = {};
        await this.saveData();
    }
}
