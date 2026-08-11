import { Filter, type IFilter } from '@adguard/dnr-converter';

export const createFilter = (
    rules: string[],
    filterId: number = 0,
): IFilter => {
    return new Filter(filterId, () => Promise.resolve(rules.join('\n')));
};
