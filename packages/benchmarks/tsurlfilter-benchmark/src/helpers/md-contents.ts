/**
 * @file Helper functions to generate markdown file contents from the benchmark results.
 */
import { formatRFC7231 } from 'date-fns';
import { markdownTable } from 'markdown-table';

import { type SystemSpecs } from './system-specs';
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

            // Print benchmark results as a markdown table with tinybench properties
            result.push(
                markdownTable(
                    [
                        [
                            'Task',
                            'Hz (ops/s)',
                            'Mean (ms)',
                            'Min (ms)',
                            'Max (ms)',
                            'P75 (ms)',
                            'P99 (ms)',
                            'P995 (ms)',
                            'P999 (ms)',
                            'RME (%)',
                            'Samples',
                            'Status',
                        ],
                        ...benchResult.benchmarkJsResults.map((benchmarkResult) => [
                            benchmarkResult.name,
                            benchmarkResult.hz.toFixed(2),
                            benchmarkResult.mean.toFixed(4),
                            benchmarkResult.min.toFixed(4),
                            benchmarkResult.max.toFixed(4),
                            benchmarkResult.p75.toFixed(4),
                            benchmarkResult.p99.toFixed(4),
                            benchmarkResult.p995.toFixed(4),
                            benchmarkResult.p999.toFixed(4),
                            benchmarkResult.rme.toFixed(2),
                            String(benchmarkResult.samples),
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
                        ['Rules count (tsurlfilter v4)', String(benchResult.stats.rulesCount)],
                        ['Rules count (tsurlfilter v3)', String(benchResult.stats.rulesCountV3)],
                    ],
                ),
            );

            result.push(EMPTY);
        }

        result.push(EMPTY);
    }

    return result.join('\n');
};
