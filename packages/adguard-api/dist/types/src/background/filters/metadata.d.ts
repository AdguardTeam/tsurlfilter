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
import { FilterMetadata } from "../schemas";
import { Logger } from "../logger";
export declare const METADATA_STORAGE_KEY = "metadata";
/**
 * Metadata Api provides methods for managing app {@link Metadata}
 */
export declare class MetadataApi {
    private metadata;
    private network;
    private storage;
    private logger;
    constructor(network: Network, storage: Storage, logger: Logger);
    /**
     * Reads and parses {@link Metadata} from extension storage.
     *
     * If metadata is invalid or not exist, try to load it form backend
     */
    init(): Promise<void>;
    /**
     * Downloads app {@link Metadata} from backend and save it in extension storage
     */
    loadMetadata(): Promise<void>;
    /**
     * Gets persisted {@link FilterMetadata} for all known filter
     *
     * @returns list of {@link FilterMetadata}
     * @throws error, if metadata is not loaded in memory
     */
    getFiltersMetadata(): FilterMetadata[];
    /**
     * Gets persisted {@link FilterMetadata} for specified filter
     *
     * @param filterId - filter id
     * @returns filter metadata for specified filter or undefined, if metadata is not found
     */
    getFilterMetadata(filterId: number): FilterMetadata | undefined;
}
