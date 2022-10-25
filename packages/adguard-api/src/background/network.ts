import FiltersDownloader from "@adguard/filters-downloader/browser";

import { UserAgent } from "./utils";

export type FilterMetadata = {
    description: string;
    displayNumber: number;
    expires: number;
    filterId: number;
    groupId: number;
    homepage: string;
    languages: string[];
    name: string;
    subscriptionUrl: string;
    tags: number[];
    timeAdded: string;
    timeUpdated: string;
    trustLevel: string;
    version: string;
};

export type TagMetadata = {
    description: string;
    keyword: string;
    name: string;
    tagId: number;
};

export type GroupMetadata = {
    displayNumber: number;
    groupId: number;
    groupName: string;
};

export type Metadata = {
    filters: FilterMetadata[];
    groups: GroupMetadata[];
    tags: TagMetadata[];
};

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

    constructor(private filtersMetadataUrl: string, private filterRulesUrl: string) {}

    /**
     * Downloads filter rules by filter ID
     *
     * @param filterId - Filter id
     */
    public async downloadFilterRules(filterId: number): Promise<string[]> {
        const url = this.filterRulesUrl.replace("{filter_id}", String(filterId));

        return FiltersDownloader.download(url, this.filterCompilerConditionsConstants);
    }

    /**
     * Downloads filters metadata
     */
    public async downloadFiltersMetadata(): Promise<Metadata> {
        const response = await fetch(this.filtersMetadataUrl);

        const metadata = await response.json();

        if (!metadata) {
            throw new Error(`Invalid response: ${response}`);
        }

        return metadata;
    }
}
