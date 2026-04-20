/**
 * @file Benchmarking script
 */

import { fileURLToPath } from 'node:url';
import path from 'path';

import { type ResourceBenchResult } from './common/interfaces';
import { resourceConfigs } from './config/resources';
import { toolConfigs } from './config/tools';
import { benchmarkResource } from './utils/benchmark-resource';
import { downloadResources } from './utils/resource-downloader';
import { printResourceResults, writeMdTable } from './utils/tables';

const RESULTS_MD_FILE = '../RESULTS.md';

const main = async () => {
    // Download the resources
    const resources = await downloadResources(resourceConfigs);

    // eslint-disable-next-line no-console
    console.log(`Downloaded ${resources.length} resource(s)`);

    const results: ResourceBenchResult[] = [];

    // Benchmark the resources
    for (const resource of resources) {
        const toolBenchResults = benchmarkResource(resource, toolConfigs);

        const result: ResourceBenchResult = {
            resourceName: resource.name,
            toolBenchResults,
        };

        // Print the actual results to the console
        printResourceResults(result);

        // Store the results
        results.push(result);
    }

    // eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    // Write all results to a markdown file
    await writeMdTable(results, path.join(__dirname, RESULTS_MD_FILE));
};

main();
