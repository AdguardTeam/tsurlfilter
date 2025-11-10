import { type NetworkRule } from '../network-rule';

import { type ConvertedRules } from './converted-rules';
import { RuleConverter } from './rule-converter';

/**
 * @typedef {import('../declarative-rule').DeclarativeRule} DeclarativeRule
 */

/**
 * Describes how to convert all rules that are not grouped for separate conversion.
 *
 * @see {@link RuleConverter} parent class.
 */
export class RegularConverter extends RuleConverter {
    /**
     * Converts ungrouped, basic {@link NetworkRule} into {@link DeclarativeRule}.
     *
     * @param filterListId Filter list ID.
     * @param rules List of {@link NetworkRule}.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     *
     * @returns Converted {@link ConvertedRules}.
     */
    public convert(
        filterListId: number,
        rules: NetworkRule[],
        usedIds: Set<number>,
    ): Promise<ConvertedRules> {
        return this.convertRules(filterListId, rules, usedIds);
    }
}
