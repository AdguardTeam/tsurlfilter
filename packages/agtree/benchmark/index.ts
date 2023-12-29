/**
 * @file Benchmarking script
 */

import path from 'path';

import { resourceConfigs } from './config/resources';
import { type ResourceBenchResult } from './common/interfaces';
import { downloadResources } from './utils/resource-downloader';
import { benchmarkResource } from './utils/benchmark-resource';
import { printResourceResults, writeMdTable } from './utils/tables';
import { toolConfigs } from './config/tools';

const RESULTS_MD_FILE = './RESULTS.md';

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

    // Write all results to a markdown file
    await writeMdTable(results, path.join(__dirname, RESULTS_MD_FILE));
};

main();
