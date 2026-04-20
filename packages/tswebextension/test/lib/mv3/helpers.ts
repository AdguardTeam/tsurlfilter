import { FilterList } from '@adguard/tsurlfilter';
import { Filter, type IFilter } from '@adguard/tsurlfilter/es/declarative-converter';

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
