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
import { Metadata, Configuration } from "./schemas";
/**
 * Network requests API
 *
 * This class provides methods for downloading {@link Metadata} and filter rules from remote source
 */
export declare class Network {
    private filterCompilerConditionsConstants;
    private filtersMetadataUrl;
    private filterRulesUrl;
    /**
     * Apply network {@link Configuration} options
     *
     * @param configuration - api {@link Configuration}
     */
    configure(configuration: Configuration): void;
    /**
     * Downloads filter rules by filter ID via {@link FiltersDownloader} module
     *
     * @param filterId - Filter id
     * @returns promise, resolved with filter rules string
     * @throws error, if {@link filterRulesUrl} is not defined or response data is not valid
     */
    downloadFilterRules(filterId: number): Promise<string[]>;
    /**
     * Downloads and validate {@link Metadata}
     *
     * @returns promise, resolved with downloaded metadata
     * @throws error, if {@link filtersMetadataUrl} is not defined, or response data is not valid
     */
    downloadFiltersMetadata(): Promise<Metadata>;
}
