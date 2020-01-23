/**
 * Represents a filtering rule
 */
// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IRule {
    /**
     * Rule's source text
     */
    getText(): string;

    /**
     * ID of the filter list this rule belongs to
     */
    getFilterListId(): number;
}
