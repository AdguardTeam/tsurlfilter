import { UnavailableFilterSourceError } from './errors/unavailable-sources-errors';

/**
 * String source for filter content.
 */
type IStringSourceProvider = {
    // Return content from string source
    getContent: () => Promise<string[]>;
};

/**
 * Describe filter with original rules.
 */
export interface IFilter {
    /**
     * Return filter id.
     */
    getId(): number;

    /**
     * Returns original rule for provided index.
     */
    getRuleByIndex(index: number): Promise<string>;

    /**
     * Returns filter's content.
     */
    getContent(): Promise<string[]>;

    /**
     * Returns if the filter is trusted or not.
     */
    isTrusted(): boolean;
}

/**
 * Saves the original rules and can return all original rules or just one,
 * with lazy content loading.
 */
export class Filter implements IFilter {
    // Id of filter
    private readonly id: number;

    // Content of filter, lazy load
    private content: string[] = [];

    // Provider of filter content
    private source: IStringSourceProvider;

    /**
     * Filter trusted flag.
     */
    private readonly trusted: boolean;

    /**
     * Creates new FilterList.
     *
     * @param id Number id of filter.
     * @param source Provider of filter content.
     * @param trusted Filter trusted flag.
     */
    constructor(
        id: number,
        source: IStringSourceProvider,
        trusted: boolean,
    ) {
        this.id = id;
        this.source = source;
        this.trusted = trusted;
    }

    /**
     * Filter id.
     *
     * @returns Filter id.
     */
    public getId(): number {
        return this.id;
    }

    /**
     * Loads content from provider to source.
     */
    private async loadContent(): Promise<void> {
        this.content = await this.source.getContent();
    }

    /**
     * Returns original filtering rule by provided id with lazy load.
     *
     * @param index Rule index.
     *
     * @throws Error {@link UnavailableFilterSourceError} if content is
     * not available.
     *
     * @returns Original filtering rule by provided identifier.
     */
    public async getRuleByIndex(index: number): Promise<string> {
        if (this.content.length === 0) {
            try {
                await this.loadContent();

                if (this.content.length === 0) {
                    throw new Error('Loaded empty content');
                }
            } catch (e) {
                const msg = 'Filter content is unavailable';
                throw new UnavailableFilterSourceError(msg, this.id, e as Error);
            }
        }

        return this.content[index];
    }

    /**
     * Returns the original filter rules with lazy loading.
     *
     * @throws UnavailableFilterSourceError if content is not available.
     *
     * @returns List of original filter rules.
     */
    public async getContent(): Promise<string[]> {
        if (this.content.length === 0) {
            try {
                await this.loadContent();
            } catch (e) {
                const msg = 'Filter content is unavailable';
                throw new UnavailableFilterSourceError(msg, this.id, e as Error);
            }
        }

        return this.content;
    }

    /**
     * Returns if the filter is trusted or not.
     *
     * @returns True if the filter is trusted, false otherwise.
     */
    public isTrusted(): boolean {
        return this.trusted;
    }
}
