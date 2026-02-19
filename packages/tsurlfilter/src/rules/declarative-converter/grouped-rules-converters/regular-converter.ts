import type { IndexedNetworkRuleWithHash } from '..';
import { type ConvertedRules } from '../converted-result';

import { AbstractRuleConverter } from './abstract-rule-converter';

/**
 * @typedef {import('../rules-grouper').RulesGroup} RulesGroup
 */

/**
 * Describes how to convert all rules that are not grouped
 * for separate conversion.
 *
 * @see {@link RulesGroup}
 */
export class RegularRulesConverter extends AbstractRuleConverter {
    /**
     * Converts ungrouped, basic indexed rules into declarative rules.
     *
     * @param filterId Filter id.
     * @param rules List of indexed network rules with hash.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     *
     * @returns Converted rules.
     */
    public convert(
        filterId: number,
        rules: IndexedNetworkRuleWithHash[],
        usedIds: Set<number>,
    ): Promise<ConvertedRules> {
        return this.convertRules(filterId, rules, usedIds);
    }
}
