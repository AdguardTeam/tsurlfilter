/* eslint-disable max-classes-per-file */

/**
 * Default rule index for source mapping.
 *
 * It is -1, similar to `Array.indexOf()` return value when element is not found.
 */
export const RULE_INDEX_NONE = -1;

/**
 * Represents a filtering rule
 */
// eslint-disable-next-line max-classes-per-file
export interface IRule {
    /**
     * Rule's source text
     */
    // FIXME(David, v2.3): remove
    getText(): string;

    /**
     * Unique rule index within the filter list, which can be used to source map the rule back to its original source.
     *
     * @return Rule index or {@link RULE_INDEX_NONE} if not available
     */
    getIndex(): number;

    /**
     * ID of the filter list this rule belongs to
     */
    getFilterListId(): number;
}

/**
 * Rule with index
 */
// FIXME(David, v2.3): possibly not needed anymore
export class IndexedRule {
    /**
     * Rule
     */
    public rule: IRule;

    /**
     * Index
     */
    public index: number;

    /**
     * Constructor
     *
     * @param rule
     * @param index
     */
    constructor(rule: IRule, index: number) {
        this.rule = rule;
        this.index = index;
    }
}

/**
 * Rule with storage index
 */
export class IndexedStorageRule {
    /**
     * Rule
     */
    public rule: IRule;

    /**
     * Index
     */
    public index: number;

    /**
     * Constructor
     *
     * @param rule
     * @param index
     */
    constructor(rule: IRule, index: number) {
        this.rule = rule;
        this.index = index;
    }
}
