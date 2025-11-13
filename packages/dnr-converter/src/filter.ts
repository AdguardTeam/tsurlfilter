/**
 * Validator for filter list conversion map where:
 * - Key is converted rule line start offset.
 * - Value is original rule text.
 *
 * @note This is only needed to show the original rule text in the filtering log if a converted rule is applied.
 */
export type FilterListConversionMap = Record<string, string>;

/**
 * Source map where:
 * - Key is rule start index in the converted list's byte buffer.
 * - Value is rule start index in the raw converted list.
 *
 * @note Since serialized rule nodes are not store original rule text, we need
 * this source map between the serialized filter list and the raw filter list.
 */
export type FilterListSourceMap = Record<string, number>;

/**
 * Interface that represents preprocessed filter list.
 */
export interface PreprocessedFilterList {
    /**
     * Raw processed filter list.
     */
    rawFilterList: string;

    /**
     * Processed filter list, but in a serialized form.
     */
    filterList: Uint8Array[];

    /**
     * Map of converted rules to original rules.
     */
    conversionMap: FilterListConversionMap;

    /**
     * Source map.
     */
    sourceMap: FilterListSourceMap;
}

/**
 * Interface that represents implementation of a filter.
 */
export interface IFilter {
    /**
     * Retrieves filter ID.
     *
     * @returns Filter ID.
     */
    getId(): number;

    /**
     * Returns original rule text by index.
     *
     * @param index Rule index to get original rule text for.
     *
     * @returns Original filtering rule text.
     *
     * @throws Error {@link UnavailableFilterSourceError} if content is not available.
     */
    getRuleByIndex(index: number): Promise<string>;

    /**
     * Returns the original filter rules with lazy loading.
     *
     * @returns Object of {@link PreprocessedFilterList}.
     *
     * @throws Error {@link UnavailableFilterSourceError} if content is not available.
     */
    getContent(): Promise<PreprocessedFilterList>;

    /**
     * Unloads filter content.
     * This method can be used to free memory until the content is needed again.
     */
    unloadContent(): void;

    /**
     * Returns if the filter is trusted or not.
     *
     * @returns `true` if the filter is trusted, `false` otherwise.
     */
    isTrusted(): boolean;
}
