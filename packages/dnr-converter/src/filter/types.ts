/**
 * @file Defines the IFilter and IFilterWithSource interfaces for the DNR converter.
 */

/**
 * Base interface for a filter list used in the simple conversion flow.
 * Suitable for callers that only need to supply a filter list id and its raw
 * text content.
 *
 * @template TContent Type returned by {@link getContent}. Defaults to `string`
 * for the simple synchronous flow; use `Promise<string>` for the advanced flow
 * with lazy loading and source-map support.
 */
export interface IFilter<TContent = string> {
    /**
     * Returns filter id.
     *
     * @returns Filter id.
     */
    getId(): number;

    /**
     * Returns the filter content.
     *
     * @returns Filter content.
     */
    getContent(): TContent;
}

/**
 * Extended filter interface for the advanced conversion flow
 * ({@link FilterConverterWithSourceMap}) with source-map support and lazy
 * content loading.
 */
export interface IFilterWithSource extends IFilter<Promise<string>> {
    /**
     * Returns original rule text by character offset.
     *
     * @param index Character offset of the rule's start in the original filter
     * text (i.e. `node.start` from the AGTree AST), **not** a line number or
     * rule-list index.
     *
     * @returns Original filtering rule at the given character offset.
     */
    getRuleByIndex(index: number): Promise<string>;

    /**
     * Returns conversion data for the filter.
     *
     * @returns Conversion metadata or undefined if not available.
     */
    getConversionData(): string | undefined;

    /**
     * Unload filter content.
     * This method can be used to free memory until the content is needed again.
     */
    unloadContent(): void;
}
