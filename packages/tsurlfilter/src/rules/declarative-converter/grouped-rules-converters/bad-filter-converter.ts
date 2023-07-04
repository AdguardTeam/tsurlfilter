import { IndexedRule } from '../../rule';
import { ConvertedRules } from '../converted-result';

import { DeclarativeRuleConverter } from './abstract-rule-converter';

/**
 * Just a dummy for $badfilter-rules, because they don't need to be converted.
 */
export class BadFilterRulesConverter extends DeclarativeRuleConverter {
    /**
     * Skips converting bad rules.
     *
     * @param filterId Filter id.
     * @param rules List of indexed rules.
     * @param offsetId Offset for the IDs of the converted rules.
     *
     * @returns Empty converted rules.
     */
    // eslint-disable-next-line class-methods-use-this
    public convert(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        filterId: number,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        rules: IndexedRule[],
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        offsetId: number,
    ): ConvertedRules {
        return {
            sourceMapValues: [],
            declarativeRules: [],
            errors: [],
        };
    }
}
