/**
 * @file You can specify the tools to benchmark in this file
 */

import { CommentRuleParser, RuleConverter, RuleParser } from '@adguard/agtree';
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
    const { RuleFactory } = tsUrlFilterInstance;

    return (content: string) => {
        // Split the content into lines
        const lines = content.split(RE_NL_SPLIT);
        let count = 0;

        for (const line of lines) {
            try {
                const convertedRules = tsUrlFilterInstance.RuleConverter.convertRule(line);

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
 * Creates a benchmark function for the given TSURLFilter instance
 *
 * @param tsUrlFilterInstance TSURLFilter instance
 * @returns Benchmark function
 */
const createNewTsUrlFilterBenchmark = (
    tsUrlFilterInstance: typeof TSUrlFilterCurrent,
) => {
    const { RuleFactory } = tsUrlFilterInstance;

    return (content: string) => {
        // Split the content into lines
        const lines = content.split(RE_NL_SPLIT);
        let count = 0;

        for (const line of lines) {
            try {
                // Ignore comments
                if (CommentRuleParser.isCommentRule(line)) {
                    // eslint-disable-next-line no-continue
                    continue;
                }

                // Parse rule with agtree
                const ruleNode = RuleParser.parse(line, { isLocIncluded: false });

                // Convert rule with agtree
                const convertedRuleNodes = RuleConverter.convertToAdg(ruleNode);

                if (!convertedRuleNodes.isConverted) {
                    // (RuleFactory.createRule as any)(ruleNode, 0);
                    count += 1;
                    continue;
                }

                for (const convertedRuleNode of convertedRuleNodes.result) {
                    (RuleFactory.createRule as any)(convertedRuleNode, 0);
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

// console.log(version)

/**
 * Tools to benchmark.
 *
 * @note `benchmark` function should return the number of rules.
 */
export const toolConfigs: ToolConfigs = {
    '@adguard/tsurlfilter current - parse and convert': {
        url: 'https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter',
        benchmark: (content: string) => {
            const benchmark = createNewTsUrlFilterBenchmark(TSUrlFilterCurrent);
            return benchmark(content);
        },
    },
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
};
