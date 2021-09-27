/**
 * Represents a filtering rule
 */
// eslint-disable-next-line max-classes-per-file
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

/**
 * Rule with index
 */
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
