/**
 * @file You can specify the tools to benchmark in this file
 */

import * as TsUrlFilterV1 from 'tsurlfilter-v1';
import * as TsUrlFilterV2 from 'tsurlfilter-v2';

// eslint-disable-next-line import/no-relative-packages, import/extensions
import * as TSUrlFilterCurrent from '../../dist/tsurlfilter.umd';
import { type ToolConfigs } from '../common/interfaces';
import { RE_NL_SPLIT } from '../common/constants';

/**
 * Creates a benchmark function for the given TSURLFilter instance
 *
 * @param tsUrlFilterInstance TSURLFilter instance
 * @returns Benchmark function
 */
const createTsUrlFilterBenchmark = (
    tsUrlFilterInstance: typeof TsUrlFilterV1 | typeof TsUrlFilterV2 | typeof TSUrlFilterCurrent,
) => {
    const { RuleFactory, RuleConverter } = tsUrlFilterInstance;

    return (content: string) => {
        // Split the content into lines
        const lines = content.split(RE_NL_SPLIT);
        let count = 0;

        for (const line of lines) {
            try {
                const convertedRules = RuleConverter.convertRule(line);

                for (const convertedRule of convertedRules) {
                    (RuleFactory.createRule as any)(convertedRule, 0);
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
    '@adguard/tsurlfilter current - parse and convert': {
        url: 'https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter',
        benchmark: (content: string) => {
            const benchmark = createTsUrlFilterBenchmark(TSUrlFilterCurrent);
            return benchmark(content);
        },
    },
};
