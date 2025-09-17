import { Filter, type IFilter } from '@adguard/tsurlfilter/es/declarative-converter';
import { ConvertedFilterList } from '@adguard/tsurlfilter';

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
