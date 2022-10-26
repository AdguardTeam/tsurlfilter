import FiltersDownloader from "@adguard/filters-downloader/browser";

import { UserAgent } from "./utils";
import { metadataValidator, Metadata, Configuration } from "./schemas";

export class Network {
    /**
     * FiltersDownloader constants
     */
    private filterCompilerConditionsConstants = {
        adguard: true,
        adguard_ext_chromium: UserAgent.isChrome,
        adguard_ext_firefox: UserAgent.isFirefox,
        adguard_ext_edge: UserAgent.isEdge,
        adguard_ext_safari: false,
        adguard_ext_opera: UserAgent.isOpera,
    };

    private filtersMetadataUrl: string | undefined;

    private filterRulesUrl: string | undefined;

    /**
     * Apply network {@link Configuration}
     *
     * @param configuration - api {@link Configuration}
     */
    public configure(configuration: Configuration) {
        const { filtersMetadataUrl, filterRulesUrl } = configuration;

        this.filtersMetadataUrl = filtersMetadataUrl;
        this.filterRulesUrl = filterRulesUrl;
    }

    /**
     * Downloads filter rules by filter ID
     *
     * @param filterId - Filter id
     */
    public async downloadFilterRules(filterId: number): Promise<string[]> {
        if (!this.filterRulesUrl) {
            throw new Error("filterRulesUrl option is not set");
        }

        const url = this.filterRulesUrl.replace("{filter_id}", String(filterId));

        return FiltersDownloader.download(url, this.filterCompilerConditionsConstants);
    }

    /**
     * Downloads filters metadata
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
