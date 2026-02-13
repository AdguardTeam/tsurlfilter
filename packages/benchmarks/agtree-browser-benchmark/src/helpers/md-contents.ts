/**
 * @file Helper functions to generate markdown file contents from the benchmark results.
 */
import { formatRFC7231 } from 'date-fns';
import { markdownTable } from 'markdown-table';

import { type SystemSpecs } from './system-specs';
import { printBytesAsMegabytes } from './format-size';
import { type FilterListBenchmarkResult } from '../interfaces';
import { EMPTY } from './constants';

/**
 * Get the markdown file contents from the benchmark results.
 *
 * @param specs System specs.
 * @param filterListResults Benchmark results.
 * @returns Markdown file contents.
 */
export const getMdFileContents = async (specs: SystemSpecs, filterListResults: FilterListBenchmarkResult[]) => {
    const result: string[] = [];

    result.push('# Benchmark results');
    result.push(EMPTY);
    result.push(`Report generated on: ${formatRFC7231(new Date())}`);
    result.push(EMPTY);

    result.push('## System specs');
    result.push(EMPTY);
    for (const [key, value] of Object.entries(specs)) {
        result.push(`- ${key}: ${value}`);
    }

    result.push(EMPTY);
    result.push('> [!NOTE]');
    result.push('> Results are sorted by performance (fastest first).');
    result.push(EMPTY);

    for (const filterListResult of filterListResults) {
        result.push(`## ${filterListResult.name}`);
        result.push(EMPTY);

        for (const benchResult of filterListResult.results) {
            result.push(`### ${benchResult.environment} ${benchResult.environmentVersion}`);
            result.push(EMPTY);

            result.push('#### Benchmark results');
            result.push(EMPTY);

            // Print benchmark results as a markdown table
            result.push(
                markdownTable(
                    [
                        ['Action', 'Ops/s', 'Runs sampled', 'Average runtime', 'Status'],
                        ...benchResult.benchmarkJsResults.map((benchmarkResult) => [
                            benchmarkResult.actionName,
                            benchmarkResult.opsPerSecond,
                            String(benchmarkResult.runsSampled),
                            benchmarkResult.averageRuntime,
                            benchmarkResult.status,
                        ]),
                    ],
                ),
            );

            result.push(EMPTY);

            result.push('#### Stats');
            result.push(EMPTY);

            // Print stats as a markdown table
            result.push(
                markdownTable(
                    [
                        ['Stat', 'Value'],
                        ['Raw filter list size (utf-8)', printBytesAsMegabytes(benchResult.stats.rawFilterListSize)],
                        ['Parsed filter list size', printBytesAsMegabytes(benchResult.stats.parsedFilterListSize)],
                    ],
                ),
            );

            result.push(EMPTY);
        }

        result.push(EMPTY);
    }

    return result.join('\n');
};
