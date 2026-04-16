import { FilterList } from '../../../src/filterlist/filter-list';
import { Filter, type IFilter } from '../../../src/rules/declarative-converter/filter';
import { FilterScanner } from '../../../src/rules/declarative-converter/filter-scanner';
import type { ScannedFilter } from '../../../src/rules/declarative-converter/network-rules-scanner';
import { NetworkRule, NetworkRuleOption } from '../../../src/rules/network-rule';

export const createFilter = (
    rules: string[],
    filterId: number = 0,
): IFilter => {
    return new Filter(
        filterId,
        { getContent: async () => new FilterList(rules.join('\n')) },
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
