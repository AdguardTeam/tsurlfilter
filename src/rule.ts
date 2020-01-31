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

    /**
     * Is rule is cosmetic rule
     */
    isCosmetic(): boolean;
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
