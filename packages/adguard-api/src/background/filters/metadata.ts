import { Network } from "../network";
import { Storage } from "../storage";
import { metadataValidator, Metadata, FilterMetadata } from "../schemas";

export class MetadataApi {
    private metadata: Metadata | undefined;

    private network: Network;

    private storage: Storage;

    constructor(network: Network, storage: Storage) {
        this.storage = storage;
        this.network = network;
    }

    public async init(): Promise<void> {
        const storageData = await this.storage.get("metadata");

        if (typeof storageData !== "string") {
            await this.loadMetadata();
            return;
        }

        try {
            const metadata = JSON.parse(storageData);
            this.metadata = metadataValidator.parse(metadata);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("Can`t parse data from metadata storage, load it from backend", e);
            await this.loadMetadata();
        }
    }

    public async loadMetadata(): Promise<void> {
        const metadata = await this.network.downloadFiltersMetadata();
        await this.storage.set("metadata", JSON.stringify(metadata));
        this.metadata = metadata;
    }

    public getFilterMetadata(filterId: number): FilterMetadata | undefined {
        if (!this.metadata) {
            throw new Error("Metadata is not loaded!");
        }
        return this.metadata.filters.find((el) => el.filterId === filterId);
    }
}
