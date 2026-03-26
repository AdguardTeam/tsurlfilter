import { Filter, type IFilter } from '@adguard/tsurlfilter/es/declarative-converter';
import { FilterList } from '@adguard/tsurlfilter';

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
