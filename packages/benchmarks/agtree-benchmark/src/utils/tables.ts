/**
 * @file Write benchmark results to a markdown file
 */

import { writeFile } from 'fs/promises';
import { markdownTable } from 'markdown-table';
import { formatRFC7231 } from 'date-fns';
import osName from 'os-name';

import { EMPTY, LINE_FEED } from '../common/constants';
import { type ResourceBenchResult } from '../common/interfaces';
import { toolConfigs } from '../config/tools';

const ALIGN_CENTER = 'c'; // https://github.com/wooorm/markdown-table#optionsalign

/**
 * Header fields for the tables
 */
const HEADERS = Object.freeze({
    TOOL: 'Tool',
    OPT_PER_SECOND: 'ops/sec',
    RUNS_SAMPLED: 'Runs sampled',
    AVERAGE_RUNTIME: 'Average runtime',
    RESULT: 'Processed rules',
    STATUS: 'Status',
});

/**
 * Write benchmark results to a markdown file
 *
 * @param resourceBenchResults Resource benchmark results
 * @param path File path to the markdown file
 */
export const writeMdTable = async (resourceBenchResults: ResourceBenchResult[], path: string) => {
    // Markdown file content
    const result: string[] = [];

    // Add the title and the date to the markdown file content
    result.push('# Benchmark results');
    result.push(EMPTY);

    result.push('## Environment');
    result.push(EMPTY);
    result.push(`- Date: ${formatRFC7231(new Date())}`);
    result.push(`- Node.js version: ${process.version}`);
    result.push(`- OS: ${osName()}`);
    result.push(EMPTY);
    result.push('> [!NOTE]');
    result.push('> Results are sorted by performance (fastest first).');
    result.push(EMPTY);
    // Disable the markdownlint rule MD013 (line length) because the table is too wide
    result.push('<!--markdownlint-disable MD013-->');

    // Iterate over the resources
    for (const { resourceName, toolBenchResults } of resourceBenchResults) {
        // Add the resource name to the markdown file content
        result.push(`## ${resourceName}`);
        result.push(EMPTY);

        // Create a markdown table
        result.push(
            markdownTable(
                [
                    // Add the table headers
                    Object.values(HEADERS),

                    // Add the table rows
                    ...toolBenchResults.map(({ toolName, ...rest }) => [
                        toolConfigs[toolName]
                            ? `[${toolName}](${toolConfigs[toolName].url})`
                            : toolName,
                        ...Object.values(rest).map(String),
                    ]),
                ],
                // Align each column to the center
                { align: Object.keys(HEADERS).map(() => ALIGN_CENTER) },
            ),
        );

        result.push(EMPTY);
    }

    // Enable the markdownlint rule MD013 (line length)
    result.push('<!--markdownlint-enable MD013-->');
    result.push(EMPTY);

    // Write the markdown file
    await writeFile(path, `${result.join(LINE_FEED)}`);
};

/**
 * Print benchmark results for a single resource
 *
 * @param param0 Resource benchmark results
 * @param param0.resourceName Resource name
 * @param param0.toolBenchResults Tool benchmark results
 */
export const printResourceResults = ({ resourceName, toolBenchResults }: ResourceBenchResult) => {
    /* eslint-disable no-console */
    console.group(`Results for ${resourceName}:`);

    console.table(toolBenchResults.map((result) => ({
        [HEADERS.TOOL]: result.toolName,
        [HEADERS.OPT_PER_SECOND]: result.opsPerSecond,
        [HEADERS.RUNS_SAMPLED]: result.runsSampled,
        [HEADERS.AVERAGE_RUNTIME]: result.averageRuntime,
        [HEADERS.RESULT]: result.result,
        [HEADERS.STATUS]: result.status,
    })));

    console.groupEnd();
    /* eslint-enable no-console */
};
