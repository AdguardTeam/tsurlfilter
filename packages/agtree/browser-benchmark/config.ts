import { defaultParserOptions } from '../src/parser/options';
import { type BenchmarkConfig } from './interfaces';

export const benchmarkConfig: BenchmarkConfig = {
    filterLists: [
        {
            name: 'AdGuard Base List',
            url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_2_Base/filter.txt',
        },
    ],
    parserOptions: {
        ...defaultParserOptions,
        tolerant: true,
        isLocIncluded: false,
        ignoreComments: true,
        parseRaws: false,
    },
};
