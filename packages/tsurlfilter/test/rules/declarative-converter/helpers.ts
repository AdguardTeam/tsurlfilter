import type { ScannedFilter } from '../../../src/rules/declarative-converter/network-rules-scanner';
import { FilterScanner } from '../../../src/rules/declarative-converter/filter-scanner';
import { Filter, type IFilter } from '../../../src/rules/declarative-converter/filter';
import { NetworkRule, NetworkRuleOption } from '../../../src/rules/network-rule';
import { ConvertedFilterList } from '../../../src/filterlist/converted-filter-list';

export const createFilter = (
    rules: string[],
    filterId: number = 0,
): IFilter => {
    return new Filter(
        filterId,
        { getContent: async () => new ConvertedFilterList(rules.join('\n')) },
        true,
    );
};

export const createScannedFilter = async (
    filterId: number,
    lines: string[],
): Promise<ScannedFilter> => {
    const filter = createFilter(lines, filterId);

    const scanner = await FilterScanner.createNew(filter);

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
