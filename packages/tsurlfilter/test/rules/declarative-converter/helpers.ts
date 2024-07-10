import type { ScannedFilter } from '../../../src/rules/declarative-converter/network-rules-scanner';
import { FilterScanner } from '../../../src/rules/declarative-converter/filter-scanner';
import { NetworkRule, NetworkRuleOption } from '../../../src';

export const createFilter = async (
    filterId: number,
    lines: string[],
): Promise<ScannedFilter> => {
    const scanner = await FilterScanner.createNew({
        getId: () => filterId,
        getContent: async () => lines,
        getRuleByIndex: async (index) => lines[index],
        isTrusted: () => true,
    });

    const { rules } = scanner.getIndexedRules();

    const badFilterRules = rules.filter(({ rule }) => {
        return rule instanceof NetworkRule && rule.isOptionEnabled(NetworkRuleOption.Badfilter);
    });

    return {
        id: filterId,
        rules,
        badFilterRules,
    };
};
