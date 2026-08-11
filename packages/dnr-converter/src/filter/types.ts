/**
 * @file Defines the IFilter interface for the DNR converter.
 */

/**
 * Interface for a filter list used in both the simple and advanced conversion
 * flows. Implementations provide filter identity, asynchronous content loading,
 * and optional source-map helpers.
 *
 * Use {@link Filter} as the concrete implementation for both pre-loaded and
 * lazy-loaded content.
 */
export interface IFilter {
    /**
     * Returns filter id.
     *
     * @returns Filter id.
     */
    getId(): number;

    /**
     * Returns the filter content.
     *
     * @returns Promise resolving to filter content.
     */
    getContent(): Promise<string>;

    /**
     * Returns original rule text by character offset.
     *
     * Optional: only invoked by the converter in the source-map flow
     * (`withSourceMap: true`). Consumers of the simple flow may omit it.
     *
     * @param index Character offset of the rule's start in the original filter
     * text (i.e. `node.start` from the AGTree AST), **not** a line number or
     * rule-list index.
     *
     * @returns Original filtering rule at the given character offset.
     */
    getRuleByIndex?(index: number): Promise<string>;

    /**
     * Unload filter content.
     * This method can be used to free memory until the content is needed again.
     */
    unloadContent(): void;
}
