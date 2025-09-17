/* eslint-disable max-classes-per-file */
import { type CosmeticRuleParts, type NetworkRuleParts, type RuleParts } from '../filterlist/rule-parts';

/**
 * Default rule index for source mapping.
 *
 * It is -1, similar to `Array.indexOf()` return value when element is not found.
 */
export const RULE_INDEX_NONE = -1;

/**
 * Represents a filtering rule.
 */
// eslint-disable-next-line max-classes-per-file
export interface IRule {
    /**
     * Unique rule index within the filter list, which can be used to source map the rule back to its original source.
     *
     * @returns Rule index or {@link RULE_INDEX_NONE} if not available.
     */
    getIndex(): number;

    /**
     * ID of the filter list this rule belongs to.
     */
    getFilterListId(): number;

    // TODO (David): Consider adding it
    // /**
    //  * Returns rule text.
    //  *
    //  * @returns Rule text.
    //  */
    // getText(): string;
}

/**
 * Indexed rule.
 */
export class IndexedRule<T> {
    /**
     * Rule.
     */
    public rule: T;

    /**
     * ID of the filter list this rule belongs to.
     */
    public listId: number;

    /**
     * Rule index.
     */
    public index: number;

    /**
     * Constructor.
     *
     * @param rule Rule.
     * @param index Index of the rule.
     * @param listId ID of the filter list this rule belongs to.
     */
    constructor(rule: T, index: number, listId: number) {
        this.listId = listId;
        this.rule = rule;
        this.index = index;
    }
}

/**
 * Indexed rule parts.
 */
export class IndexedRuleParts<T extends RuleParts = RuleParts> {
    /**
     * Rule parts.
     */
    public ruleParts: T;

    /**
     * ID of the filter list this rule belongs to.
     */
    public listId: number;

    /**
     * Rule index.
     */
    public index: number;

    /**
     * Constructor.
     *
     * @param ruleParts Rule parts.
     * @param index Index of the rule.
     * @param listId ID of the filter list this rule belongs to.
     */
    constructor(ruleParts: T, index: number, listId: number) {
        this.listId = listId;
        this.ruleParts = ruleParts;
        this.index = index;
    }
}

/**
 * Indexed storage rule parts.
 */
export class IndexedStorageRuleParts<T extends RuleParts = RuleParts> {
    /**
     * Rule parts.
     */
    public ruleParts: T;

    /**
     * Rule index.
     */
    public index: number;

    /**
     * ID of the filter list this rule belongs to.
     */
    public listId: number;

    /**
     * Constructor.
     *
     * @param ruleParts Rule.
     * @param index Index of the rule.
     * @param listId ID of the filter list this rule belongs to.
     */
    constructor(ruleParts: T, index: number, listId: number) {
        this.listId = listId;
        this.ruleParts = ruleParts;
        this.index = index;
    }
}

/**
 * Indexed storage network rule.
 */
export type IndexedStorageNetworkRuleParts = IndexedStorageRuleParts<NetworkRuleParts>;

/**
 * Indexed storage cosmetic rule.
 */
export type IndexedStorageCosmeticRuleParts = IndexedStorageRuleParts<CosmeticRuleParts>;
