/**
 * Represents a filtering rule
 */
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
