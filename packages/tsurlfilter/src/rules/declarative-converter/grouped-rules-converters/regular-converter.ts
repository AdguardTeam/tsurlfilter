import { IndexedRule } from '../../rule';
import { ConvertedRules } from '../converted-result';

import { DeclarativeRuleConverter } from './abstract-rule-converter';

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
     * @param rules List of indexed rules.
     * @param offsetId Offset for the IDs of the converted rules.
     *
     * @returns Converted rules.
     */
    public convert(
        filterId: number,
        rules: IndexedRule[],
        offsetId: number,
    ): ConvertedRules {
        return this.convertRules(filterId, rules, offsetId);
    }
}
