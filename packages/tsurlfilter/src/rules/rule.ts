/* eslint-disable max-classes-per-file */

import { type RuleParts } from '../filterlist/tokenize';

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
}

/**
 * Rule with index.
 */
// TODO: Consider remove this because rule already has an index field
export class IndexedRule {
    /**
     * Rule.
     */
    public rule: RuleParts;

    public listId: number;

    /**
     * Index.
     */
    public index: number;

    /**
     * Constructor.
     *
     * @param rule Rule.
     * @param index Index of the rule.
     * @param listId ID of the filter list this rule belongs to.
     */
    constructor(rule: RuleParts, index: number, listId: number) {
        this.listId = listId;
        this.rule = rule;
        this.index = index;
    }
}

/**
 * Rule with storage index.
 */
export class IndexedStorageRule {
    /**
     * Rule.
     */
    public rule: RuleParts;

    /**
     * Index.
     */
    public index: number;

    public listId: number;

    /**
     * Constructor.
     *
     * @param rule Rule.
     * @param index Index of the rule.
     * @param listId ID of the filter list this rule belongs to.
     */
    constructor(rule: RuleParts, index: number, listId: number) {
        this.listId = listId;
        this.rule = rule;
        this.index = index;
    }
}
