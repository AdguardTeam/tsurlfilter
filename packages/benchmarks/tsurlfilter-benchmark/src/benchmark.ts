/* eslint-disable no-console */
/**
 * @file Benchmark script for AGTree which measures the performance of the library in browser environment.
 *
 * @note Usage: tsx benchmark.ts
 */

import { buildSync } from 'esbuild';
import { chromium, firefox, webkit } from 'playwright';
import path from 'node:path';
import { createConsola } from 'consola';
import { Table } from 'console-table-printer';
import { writeFile } from 'node:fs/promises';

import { benchmarkConfig } from './config';
import { type SystemSpecs, getSystemSpecs } from './helpers/system-specs';
import { downloadFilterLists } from './helpers/filter-downloader';
import { getMdFileContents } from './helpers/md-contents';
import { runBenchmarkBrowser } from './benchmark-runner-browser';
import { type FilterListBenchmarkResult } from './interfaces';
import { type BenchmarkResult } from './benchmark-code';
import { runBenchmarkNode } from './benchmark-runner-node';
import { fileURLToPath } from 'node:url';

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
            Task: benchmarkResult.name,
            'Hz (ops/s)': `${benchmarkResult.hz.toFixed(2)} ±${benchmarkResult.rme.toFixed(2)}%`,
            'Mean (ms)': benchmarkResult.mean.toFixed(2),
            'Min (ms)': benchmarkResult.min.toFixed(2),
            'Max (ms)': benchmarkResult.max.toFixed(2),
            'P99 (ms)': benchmarkResult.p99.toFixed(2),
            Samples: benchmarkResult.samples,
            Status: benchmarkResult.status,
        });
    }

    table.printTable();

    const statsTable = new Table();

    const statsWithTitles = {
        'Rules count (tsurlfilter v4)': results.stats.rulesCount,
        'Rules count (tsurlfilter v3)': results.stats.rulesCountV3,
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

    consola.info('Building TSUrlFilter IIFE (just in-memory)...');
    const tsurlfilterIife = buildSync({
        bundle: true,
        format: 'iife',
        globalName: 'TsUrlFilter',
        target: 'chrome106',
        entryPoints: [path.join(__dirname, './tsurlfilter/tsurlfilter.ts')],
        logLevel: 'error',
        write: false,
    });
    if (tsurlfilterIife.errors.length) {
        throw new Error('Failed to build TSUrlFilter IIFE');
    }
    consola.success('Build successful');

    consola.info('Building TSUrlFilter v3 IIFE (just in-memory)...');
    const tsurlfilterV3Iife = buildSync({
        bundle: true,
        format: 'iife',
        globalName: 'TsUrlFilterV3',
        target: 'chrome106',
        entryPoints: [path.join(__dirname, './tsurlfilter/tsurlfilter-v3.ts')],
        logLevel: 'error',
        write: false,
    });
    if (tsurlfilterV3Iife.errors.length) {
        throw new Error('Failed to build TSUrlFilter v3 IIFE');
    }
    consola.success('Build successful');

    consola.info('Building tinybench IIFE (just in-memory)...');
    const tinybenchIife = buildSync({
        bundle: true,
        format: 'iife',
        globalName: 'Tinybench',
        target: 'es2020',
        platform: 'browser',
        entryPoints: [path.join(__dirname, '../node_modules/tinybench/dist/index.js')],
        logLevel: 'error',
        write: false,
        keepNames: true,
        banner: {
            // eslint-disable-next-line max-len
            js: 'var __name = function(target, value) { Object.defineProperty(target, "name", { value: value, configurable: true }); };',
        },
    });
    if (tinybenchIife.errors.length) {
        throw new Error('Failed to build tinybench IIFE');
    }
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
                tsurlfilterIife.outputFiles[0].text,
                tsurlfilterV3Iife.outputFiles[0].text,
                tinybenchIife.outputFiles[0].text,
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
    const resultsPath = path.join(__dirname, '../RESULTS.md');
    await writeFile(resultsPath, mdFileContents);
    consola.success(`Results written to ${resultsPath}`);

    const end = Date.now();
    consola.success(`Benchmark completed in ${(end - start) / 1000} seconds`);
})());
