/* eslint-disable no-console */
/**
 * @file Benchmark script for AGTree which measures the performance of the library in browser environment.
 *
 * @note Usage: npx ts-node benchmark.ts
 */

import { chromium, firefox, webkit } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createConsola } from 'consola';
import { Table } from 'console-table-printer';
import { mkdir, writeFile } from 'node:fs/promises';

import { buildIife } from './helpers/build-iife';
import { benchmarkConfig } from './config';
import { type SystemSpecs, getSystemSpecs } from './helpers/system-specs';
import { printBytesAsMegabytes } from './helpers/format-size';
import { downloadFilterLists } from './helpers/filter-downloader';
import { getMdFileContents } from './helpers/md-contents';
import { runBenchmarkBrowser } from './benchmark-runner-browser';
import { type FilterListBenchmarkResult } from './interfaces';
import { type BenchmarkResult } from './benchmark-code';
import { runBenchmarkNode } from './benchmark-runner-node';
import { buildAgTreeForNode } from './helpers/build-agtree-node';
import { pathExists } from './helpers/fs';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// TODO: Add 'debug' logs, if needed
const consola = createConsola();

/**
 * Helper function to print benchmark results.
 *
 * @param results Benchmark results to print.
 */
const printResults = (results: BenchmarkResult): void => {
    consola.info(`Benchmark results for ${results.environment} ${results.environmentVersion}`);

    const table = new Table();

    for (const benchmarkResult of results.benchmarkJsResults) {
        table.addRow({
            'Filter list': benchmarkResult.actionName,
            'Ops/s': benchmarkResult.opsPerSecond,
            'Runs sampled': benchmarkResult.runsSampled,
            'Average runtime': benchmarkResult.averageRuntime,
            Status: benchmarkResult.status,
        });
    }

    table.printTable();

    const statsTable = new Table();

    const statsWithTitles = {
        'Raw filter list size (utf-8)': printBytesAsMegabytes(results.stats.rawFilterListSize),
        'Parsed filter list size': printBytesAsMegabytes(results.stats.parsedFilterListSize),
        'Serialized size': printBytesAsMegabytes(results.stats.serializedFilterListSize),
        'Deserialized filter list size': printBytesAsMegabytes(results.stats.deserializedFilterListSize),
    };

    // print stats as a table: Stat and Value
    for (const [stat, value] of Object.entries(statsWithTitles)) {
        statsTable.addRow({ Stat: stat, Value: value });
    }

    statsTable.printTable();
};

/**
 * Helper function to print system specs to the console.
 *
 * @param specs System specs to print.
 */
const printSystemSpecs = async (specs: SystemSpecs) => {
    const specsTable = new Table();

    for (const [key, value] of Object.entries(specs)) {
        specsTable.addRow({ Spec: key, Value: value });
    }

    specsTable.printTable();
};

/**
 * Main IIFE to run the benchmark.
 */
((async () => {
    const start = Date.now();
    consola.info('Starting the benchmark...');

    const specs = await getSystemSpecs();
    await printSystemSpecs(specs);

    consola.info('Downloading filter lists...');
    const downloadedFilterLists = await downloadFilterLists(benchmarkConfig.filterLists);
    // eslint-disable-next-line max-len
    consola.success(`Downloaded ${downloadedFilterLists.length} filter list${downloadedFilterLists.length > 1 ? 's' : ''}`);

    consola.info('Building AGTree IIFE (just in-memory)...');
    const agtreeIife = await buildIife(
        path.join(__dirname, '../src/index.ts'),
        'AGTree',
    );
    consola.success('Build successful');

    consola.info('Building object-sizeof IIFE (just in-memory)...');
    const objectSizeofIife = await buildIife(
        path.join(__dirname, '../node_modules/object-sizeof/index.js'),
        'ObjectSizeof',
    );
    consola.success('Build successful');

    consola.info('Build AGTree for Node.js...');
    // make temp directory if it doesn't exist
    const tempDir = path.join(__dirname, 'temp');
    if (!await pathExists(tempDir)) {
        await mkdir(tempDir);
    }
    const agTreeBundlePath = path.join(tempDir, 'agtree-node.js');
    await writeFile(agTreeBundlePath, await buildAgTreeForNode());
    consola.success('Build successful');

    const results: FilterListBenchmarkResult[] = [];

    consola.info('Benchmarking...');
    for (const filterList of downloadedFilterLists) {
        consola.box(`Benchmarking ${filterList.name}...`);

        const filterListResult: FilterListBenchmarkResult = {
            name: filterList.name,
            results: [],
        };

        // run in Node.js
        const nodeResult = await runBenchmarkNode(
            filterList,
            benchmarkConfig.parserOptions,
        );

        if (nodeResult instanceof Error) {
            consola.error(nodeResult);
        } else {
            printResults(nodeResult);
            filterListResult.results.push({ ...nodeResult });
            console.log();
        }

        for (const launcher of [chromium, firefox, webkit]) {
            const result = await runBenchmarkBrowser(
                launcher,
                filterList,
                benchmarkConfig.parserOptions,
                agtreeIife,
                objectSizeofIife,
            );

            if (result instanceof Error) {
                consola.error(result);
                continue;
            }

            printResults(result);
            filterListResult.results.push({ ...result });
            console.log();
        }

        results.push(filterListResult);
    }

    consola.info('Writing results to file...');
    const mdFileContents = await getMdFileContents(specs, results);
    const resultsPath = path.join(__dirname, 'RESULTS.md');
    await writeFile(resultsPath, mdFileContents);
    consola.success(`Results written to ${resultsPath}`);

    const end = Date.now();
    consola.success(`Benchmark completed in ${(end - start) / 1000} seconds`);
})());
