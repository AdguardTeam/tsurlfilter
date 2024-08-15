/**
 * @file You can specify the tools to benchmark in this file
 */

import * as TsUrlFilterV1 from 'tsurlfilter-v1';
import * as TsUrlFilterV2 from 'tsurlfilter-v2';
import * as AGTreeV1 from 'agtree-v1';

// eslint-disable-next-line import/no-relative-packages, import/extensions
import * as AGTreeV2 from '../../dist/agtree.cjs';
import { type ToolConfigs } from '../common/interfaces';
import { RE_NL_SPLIT } from '../common/constants';

/**
 * Creates a benchmark function for the given TSURLFilter instance
 *
 * @param tsUrlFilterInstance TSURLFilter instance
 * @returns Benchmark function
 */
const createTsUrlFilterBenchmark = (tsUrlFilterInstance: typeof TsUrlFilterV1 | typeof TsUrlFilterV2) => {
    const { RuleFactory, RuleConverter } = tsUrlFilterInstance;

    return (content: string) => {
        // Split the content into lines
        const lines = content.split(RE_NL_SPLIT);
        let count = 0;

        for (const line of lines) {
            try {
                const convertedRules = RuleConverter.convertRule(line);

                for (const convertedRule of convertedRules) {
                    RuleFactory.createRule(convertedRule, 0);
                    count += 1;
                }
            } catch (e) {
                // Silently ignore any errors
                // eslint-disable-next-line no-continue
                continue;
            }
        }

        return count;
    };
};

/**
 * Tools to benchmark.
 *
 * @note `benchmark` function should return the number of rules.
 */
export const toolConfigs: ToolConfigs = {
    '@adguard/tsurlfilter v1 - parse and convert': {
        url: 'https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter',
        benchmark: (content: string) => {
            const benchmark = createTsUrlFilterBenchmark(TsUrlFilterV1);
            return benchmark(content);
        },
    },
    '@adguard/tsurlfilter v2 - parse and convert': {
        url: 'https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter',
        benchmark: (content: string) => {
            const benchmark = createTsUrlFilterBenchmark(TsUrlFilterV2);
            return benchmark(content);
        },
    },
    '@adguard/agtree v1 - parse and convert': {
        url: 'https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree',
        benchmark: (content: string) => {
            const filterListNode = AGTreeV1.FilterListParser.parse(content);
            const { result: convertedFilterListNode } = AGTreeV1.FilterListConverter.convertToAdg(filterListNode);
            return convertedFilterListNode.children.length;
        },
    },
    '@adguard/agtree v2 - parse and convert': {
        url: 'https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree',
        benchmark: (content: string) => {
            const filterListNode = AGTreeV2.FilterListParser.parse(content, { isLocIncluded: false, tolerant: true });
            const { result: convertedFilterListNode } = AGTreeV2.FilterListConverter.convertToAdg(filterListNode);
            return convertedFilterListNode.children.length;
        },
    },
    '@adguard/agtree v1 - parser': {
        url: 'https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree',
        benchmark: (content: string) => {
            const filterListNode = AGTreeV1.FilterListParser.parse(content);
            return filterListNode.children.length;
        },
    },
    '@adguard/agtree v2 - parser': {
        url: 'https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree',
        benchmark: (content: string) => {
            const filterListNode = AGTreeV2.FilterListParser.parse(content, { isLocIncluded: false, tolerant: true });
            return filterListNode.children.length;
        },
    },
};
