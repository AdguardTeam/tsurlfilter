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
import { metadataValidator, Metadata, FilterMetadata } from "../schemas";
import { Logger } from "../logger";

// Metadata storage key for browser.storage.local
export const METADATA_STORAGE_KEY = "metadata";

/**
 * Metadata Api provides methods for managing app {@link Metadata}
 */
export class MetadataApi {
    // Cached app metadata
    private metadata: Metadata | undefined;

    // Network requests API
    private network: Network;

    // Dev-friendly API for key-value extension storage
    private storage: Storage;

    // Simple Api for logging
    private logger: Logger;

    constructor(network: Network, storage: Storage, logger: Logger) {
        this.storage = storage;
        this.network = network;
        this.logger = logger;
    }

    /**
     * Reads and parses {@link Metadata} from extension storage.
     *
     * If metadata is invalid or not exist, try to load it form backend
     */
    public async init(): Promise<void> {
        const storageData = await this.storage.get(METADATA_STORAGE_KEY);

        if (typeof storageData !== "string") {
            await this.loadMetadata();
            return;
        }

        try {
            const metadata = JSON.parse(storageData);
            this.metadata = metadataValidator.parse(metadata);
        } catch (e) {
            this.logger.warn("Can`t parse data from metadata storage, load it from backend", e);
            await this.loadMetadata();
        }
    }

    /**
     * Downloads app {@link Metadata} from backend and save it in extension storage
     */
    public async loadMetadata(): Promise<void> {
        try {
            const metadata = await this.network.downloadFiltersMetadata();
            await this.storage.set(METADATA_STORAGE_KEY, JSON.stringify(metadata));
            this.metadata = metadata;
        } catch (e) {
            this.logger.error("Can`t download metadata", e);
        }
    }

    /**
     * Gets persisted {@link FilterMetadata} for all known filter
     *
     * @returns list of {@link FilterMetadata}
     * @throws error, if metadata is not loaded in memory
     */
    public getFiltersMetadata(): FilterMetadata[] {
        if (!this.metadata) {
            throw new Error("Metadata is not loaded!");
        }
        return this.metadata.filters;
    }

    /**
     * Gets persisted {@link FilterMetadata} for specified filter
     *
     * @param filterId - filter id
     * @returns filter metadata for specified filter or undefined, if metadata is not found
     */
    public getFilterMetadata(filterId: number): FilterMetadata | undefined {
        return this.getFiltersMetadata().find((el) => el.filterId === filterId);
    }
}
