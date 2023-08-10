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

import FiltersDownloader, { type DefinedExpressions } from "@adguard/filters-downloader/browser";

import { UserAgent } from "./utils";
import { metadataValidator, Metadata, Configuration } from "./schemas";

/**
 * Network requests API
 *
 * This class provides methods for downloading {@link Metadata} and filter rules from remote source
 */
export class Network {
    // FiltersDownloader constants
    private filterCompilerConditionsConstants: DefinedExpressions = {
        adguard: true,
        adguard_ext_chromium: UserAgent.isChrome,
        adguard_ext_firefox: UserAgent.isFirefox,
        adguard_ext_edge: UserAgent.isEdge,
        adguard_ext_safari: false,
        adguard_ext_opera: UserAgent.isOpera,
    };

    // Cached filters metadata url
    private filtersMetadataUrl: string | undefined;

    // Cached filter rules url template
    private filterRulesUrl: string | undefined;

    /**
     * Apply network {@link Configuration} options
     *
     * @param configuration - api {@link Configuration}
     */
    public configure(configuration: Configuration): void {
        const { filtersMetadataUrl, filterRulesUrl } = configuration;

        this.filtersMetadataUrl = filtersMetadataUrl;
        this.filterRulesUrl = filterRulesUrl;
    }

    /**
     * Downloads filter rules by filter ID via {@link FiltersDownloader} module
     *
     * @param filterId - Filter id
     * @returns promise, resolved with filter rules string
     * @throws error, if {@link filterRulesUrl} is not defined or response data is not valid
     */
    public async downloadFilterRules(filterId: number): Promise<string[]> {
        if (!this.filterRulesUrl) {
            throw new Error("filterRulesUrl option is not set");
        }

        const url = this.filterRulesUrl.replace("{filter_id}", String(filterId));

        return FiltersDownloader.download(url, this.filterCompilerConditionsConstants);
    }

    /**
     * Downloads and validate {@link Metadata}
     *
     * @returns promise, resolved with downloaded metadata
     * @throws error, if {@link filtersMetadataUrl} is not defined, or response data is not valid
     */
    public async downloadFiltersMetadata(): Promise<Metadata> {
        if (!this.filtersMetadataUrl) {
            throw new Error("filtersMetadataUrl option is not set");
        }

        const response = await fetch(this.filtersMetadataUrl);

        const metadata = await response.json();

        if (!metadata) {
            throw new Error(`Invalid response: ${response}`);
        }

        return metadataValidator.parse(metadata);
    }
}
