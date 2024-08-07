import { EMPTY_STRING } from '../../common/constants';
import { type PreprocessedFilterList } from '../../filterlist/preprocessor';
import { getRuleSourceIndex, getRuleSourceText } from '../../filterlist/source-map';

import { UnavailableFilterSourceError } from './errors/unavailable-sources-errors';

/**
 * String source for filter content.
 */
type IStringSourceProvider = {
    // Return content from string source
    getContent: () => Promise<PreprocessedFilterList>;
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
    getContent(): Promise<PreprocessedFilterList>;

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
    private content: PreprocessedFilterList | null = null;

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
     * Returns the original filter rules with lazy loading.
     *
     * @throws UnavailableFilterSourceError if content is not available.
     *
     * @returns List of original filter rules.
     */
    public async getContent(): Promise<PreprocessedFilterList> {
        if (this.content) {
            return this.content;
        }

        try {
            this.content = await this.source.getContent();

            if (!this.content || this.content.rawFilterList.length === 0 || this.content.filterList.length === 0) {
                throw new Error('Loaded empty content');
            }

            return this.content;
        } catch (e) {
            throw new UnavailableFilterSourceError('Filter content is unavailable', this.id, e as Error);
        }
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
        const content = await this.getContent();

        const lineIndex = getRuleSourceIndex(index, content.sourceMap);
        const sourceRule = getRuleSourceText(lineIndex, content.rawFilterList) ?? EMPTY_STRING;

        return sourceRule;
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
