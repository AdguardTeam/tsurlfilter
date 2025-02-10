import { EMPTY_STRING } from '../../common/constants';
import { type PreprocessedFilterList } from '../../filterlist/preprocessor';
import { getRuleSourceIndex, getRuleSourceText } from '../../filterlist/source-map';

import { UnavailableFilterSourceError } from './errors/unavailable-sources-errors';

/**
 * String source for filter content.
 */
type IStringSourceProvider = {
    /**
     * Returns filter content.
     */
    getContent: () => Promise<PreprocessedFilterList>;
};

/**
 * Describe filter with original rules.
 */
export interface IFilter {
    /**
     * Return filter id.
     *
     * @returns Filter id.
     */
    getId(): number;

    /**
     * Returns original rule text by index.
     *
     * @param index Rule index.
     *
     * @returns Original filtering rule by provided identifier.
     *
     * @throws Error {@link UnavailableFilterSourceError} if content is not available.
     */
    getRuleByIndex(index: number): Promise<string>;

    /**
     * Returns the original filter rules with lazy loading.
     *
     * @returns List of original filter rules.
     *
     * @throws Error {@link UnavailableFilterSourceError} if content is not available.
     */
    getContent(): Promise<PreprocessedFilterList>;

    /**
     * Unload filter content.
     * This method can be used to free memory until the content is needed again.
     */
    unloadContent(): void;

    /**
     * Returns if the filter is trusted or not.
     *
     * @returns True if the filter is trusted, false otherwise.
     */
    isTrusted(): boolean;
}

/**
 * Saves the original rules and can return all original rules or just one,
 * with lazy content loading.
 */
export class Filter implements IFilter {
    /**
     * ID of filter.
     */
    private readonly id: number;

    /**
     * Content of filter (lazy loading).
     */
    private content: PreprocessedFilterList | null = null;

    /**
     * Promise for content loading.
     */
    private contentLoadingPromise: Promise<PreprocessedFilterList> | null = null;

    /**
     * Provider of filter content.
     */
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

    /** @inheritdoc */
    public getId(): number {
        return this.id;
    }

    /** @inheritdoc */
    public async getContent(): Promise<PreprocessedFilterList> {
        // If content is already loaded, return it
        if (this.content) {
            return this.content;
        }

        // If content is currently loading, return the existing promise
        if (this.contentLoadingPromise) {
            return this.contentLoadingPromise;
        }

        // Assign the promise immediately to avoid race conditions
        this.contentLoadingPromise = (async (): Promise<PreprocessedFilterList> => {
            try {
                const content = await this.source.getContent();

                if (!content || content.rawFilterList.length === 0 || content.filterList.length === 0) {
                    throw new Error('Loaded empty content');
                }

                // Assign content and clear the loading promise
                this.content = content;
                this.contentLoadingPromise = null;
                return content;
            } catch (e) {
                // Reset the loading promise so future calls can retry
                this.contentLoadingPromise = null;
                throw new UnavailableFilterSourceError('Filter content is unavailable', this.id, e as Error);
            }
        })();

        return this.contentLoadingPromise;
    }

    /** @inheritdoc */
    public async getRuleByIndex(index: number): Promise<string> {
        const content = await this.getContent();

        const lineIndex = getRuleSourceIndex(index, content.sourceMap);
        const sourceRule = getRuleSourceText(lineIndex, content.rawFilterList) ?? EMPTY_STRING;

        return sourceRule;
    }

    /** @inheritdoc */
    public isTrusted(): boolean {
        return this.trusted;
    }

    /** @inheritdoc */
    public unloadContent(): void {
        // If content is not loaded and not loading, there is nothing to unload
        if (!this.content && !this.contentLoadingPromise) {
            return;
        }

        // If loading is in progress
        if (this.contentLoadingPromise) {
            this.contentLoadingPromise.finally(() => {
                this.unloadContent();
            });
            return;
        }

        // Unload content
        this.content = null;
        this.contentLoadingPromise = null;
    }
}
