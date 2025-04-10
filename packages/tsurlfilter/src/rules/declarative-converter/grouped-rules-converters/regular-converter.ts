import type { IndexedNetworkRuleWithHash } from '..';
import { type ConvertedRules } from '../converted-result';

import { DeclarativeRuleConverter } from './abstract-rule-converter';

/**
 * @typedef {import('../rules-grouper').RulesGroup} RulesGroup
 */

/**
 * Describes how to convert all rules that are not grouped
 * for separate conversion.
 *
 * @see {@link RulesGroup}
 */
export class RegularRulesConverter extends DeclarativeRuleConverter {
    /**
     * Converts ungrouped, basic indexed rules into declarative rules.
     *
     * @param filterId Filter id.
     * @param rules List of indexed network rules with hash.
     * @param offsetId Offset for the IDs of the converted rules.
     *
     * @returns Converted rules.
     */
    public convert(
        filterId: number,
        rules: IndexedNetworkRuleWithHash[],
        offsetId: number,
    ): Promise<ConvertedRules> {
        return this.convertRules(filterId, rules, offsetId);
    }
}
