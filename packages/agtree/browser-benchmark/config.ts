/**
 * @file Configuration for the benchmark.
 */

import { defaultParserOptions } from '../src/parser/options';
import { type BenchmarkConfig } from './interfaces';

export const benchmarkConfig: BenchmarkConfig = {
    filterLists: [
        {
            name: 'EasyList',
            url: 'https://easylist.to/easylist/easylist.txt',
        },
        {
            name: 'AdGuard Base List',
            url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_2_Base/filter.txt',
        },
        {
            name: 'uBlock Base List',
            url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
        },
    ],
    parserOptions: {
        ...defaultParserOptions,
        tolerant: true,
        isLocIncluded: false,
        ignoreComments: true,
        includeRaws: false,
    },
};
