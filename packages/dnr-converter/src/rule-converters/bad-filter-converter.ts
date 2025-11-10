import { type NetworkRule } from '../network-rule';

import { type ConvertedRules } from './converted-rules';
import { RuleConverter } from './rule-converter';

/**
 * Just a dummy for `$badfilter` rules, because they don't need to be converted.
 *
 * @see {@link RuleConverter} parent class.
 */
export class BadFilterConverter extends RuleConverter {
    /**
     * Skips converting bad rules.
     *
     * @param filterListId Filter list ID.
     * @param rules List of {@link NetworkRule}.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     *
     * @returns Empty {@link ConvertedRules}.
     */
    // eslint-disable-next-line class-methods-use-this
    public async convert(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        filterListId: number,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        rules: NetworkRule[],
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        usedIds: Set<number>,
    ): Promise<ConvertedRules> {
        return {
            sourceMapValues: [],
            declarativeRules: [],
            errors: [],
        };
    }
}
