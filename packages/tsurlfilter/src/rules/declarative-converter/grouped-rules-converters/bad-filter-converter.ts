import type { IndexedNetworkRuleWithHash } from '../network-indexed-rule-with-hash';
import { type ConvertedRules } from '../converted-result';

import { AbstractRuleConverter } from './abstract-rule-converter';

/**
 * Just a dummy for $badfilter-rules, because they don't need to be converted.
 */
export class BadFilterRulesConverter extends AbstractRuleConverter {
    /**
     * Skips converting bad rules.
     *
     * @param filterId Filter id.
     * @param rules List of indexed rules.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     *
     * @returns Empty converted rules.
     */
    // eslint-disable-next-line class-methods-use-this
    public convert(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        filterId: number,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        rules: IndexedNetworkRuleWithHash[],
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        usedIds: Set<number>,
    ): Promise<ConvertedRules> {
        return Promise.resolve({
            sourceMapValues: [],
            declarativeRules: [],
            errors: [],
        });
    }
}
