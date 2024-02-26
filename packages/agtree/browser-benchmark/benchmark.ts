/* eslint-disable no-console */
/**
 * @file Benchmark script for AGTree which measures the performance of the library in browser environment.
 *
 * @note Usage: npx tsx benchmark.ts
 */

import {
    chromium,
    firefox,
    webkit,
    type Browser,
    type BrowserType,
} from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createConsola } from 'consola';
import { Table } from 'console-table-printer';

import { type ParserOptions } from '../src/parser/options';
import {
    type PageContextBenchmarkResults,
    pageContextBenchmark,
    type PageContextBenchmarkArgs,
} from './page-context-benchmark';
import { buildIife } from './helpers/build-iife';
import { benchmarkConfig } from './config';
import { type FilterListResource } from './interfaces';
import { fetchFile } from './helpers/fetch-file';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// TODO: Add 'debug' logs, if needed
const consola = createConsola();

/**
 * Run the benchmark in the given browser.
 *
 * @param browserLauncher Browser launcher to use.
 * @param filterList Filter list resource to benchmark.
 * @param agtreeParserOptions AGTree parser options.
 * @param agtreeIife AGTree IIFE code to be injected into the browser.
 * @param objectSizeofIife object-sizeof IIFE code to be injected into the browser.
 * @returns Benchmark results or null if an error occurred.
 */
const runBenchmark = async (
    browserLauncher: BrowserType,
    filterList: FilterListResource,
    agtreeParserOptions: ParserOptions,
    agtreeIife: string,
    objectSizeofIife: string,
): Promise<PageContextBenchmarkResults | null> => {
    consola.info(`Launching browser: ${browserLauncher.name()}...`);

    let browser: Browser | null = null;

    try {
        browser = await browserLauncher.launch();
        consola.info(`Running benchmark in ${browser.browserType().name()} ${browser.version()}...`);

        const context = await browser.newContext();
        const page = await context.newPage();

        // These modules requires pre-building
        await page.addScriptTag({ content: agtreeIife });
        await page.addScriptTag({ content: objectSizeofIife });
        // These modules can be used directly from 'node_modules'
        await page.addScriptTag({ path: '../node_modules/lodash/lodash.js' });
        await page.addScriptTag({ path: '../node_modules/benchmark/benchmark.js' });

        // Evaluate the benchmark in the browser
        const result = await page.evaluate(
            pageContextBenchmark,
            {
                rawFilterList: filterList.raw,
                agtreeParserOptions,
            } as PageContextBenchmarkArgs,
        );

        await page.close();
        await browser.close();

        return result;
    } catch (error) {
        if (browser !== null) {
            await browser.close();
        }

        consola.error(error);

        return null;
    }
};

/**
 * Helper function to download filter lists.
 *
 * @param filterLists Filter lists to download.
 * @returns Number of downloaded filter lists.
 *
 * @note This function modifies the input array
 */
const downloadFilterLists = async (filterLists: FilterListResource[]): Promise<number> => {
    let downloaded = 0;

    for (const filterList of filterLists) {
        // Skip if already downloaded
        if (filterList.raw) {
            continue;
        }

        const raw = await fetchFile(filterList.url);
        filterList.raw = raw;
        downloaded += 1;
    }

    return downloaded;
};

/**
 * Helper function to print bytes as megabytes.
 *
 * @param bytes Bytes to print.
 * @returns String representation of bytes in megabytes.
 */
const printBytesAsMegabytes = (bytes: number): string => {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

/**
 * Helper function to print benchmark results.
 *
 * @param results Benchmark results to print.
 */
const printResults = (results: PageContextBenchmarkResults): void => {
    const table = new Table();

    for (const benchmarkResult of results.results) {
        table.addRow({
            'Filter list': benchmarkResult.toolName,
            'Ops/s': benchmarkResult.opsPerSecond,
            'Runs sampled': benchmarkResult.runsSampled,
            'Average runtime': benchmarkResult.averageRuntime,
            Status: benchmarkResult.status,
        });
    }

    table.printTable();

    const statsTable = new Table();

    const statsWithTitles = {
        'Raw filter list size': printBytesAsMegabytes(results.stats.rawFilterListSize),
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
 * Main IIFE to run the benchmark.
 */
((async () => {
    consola.info('Starting the benchmark');

    consola.info('Downloading filter lists...');
    const downloaded = await downloadFilterLists(benchmarkConfig.filterLists);
    consola.success(`Downloaded ${downloaded} filter lists`);

    consola.info('Building AGTree IIFE...');
    const agtreeIife = await buildIife(
        path.join(__dirname, '../src/index.ts'),
        'AGTree',
    );
    consola.success('Build successful');

    consola.info('Building object-sizeof IIFE...');
    const objectSizeofIife = await buildIife(
        path.join(__dirname, '../node_modules/object-sizeof/index.js'),
        'ObjectSizeof',
    );
    consola.success('Build successful');

    consola.info('Benchmarking...');
    for (const filterList of benchmarkConfig.filterLists) {
        consola.box(`Benchmarking ${filterList.name}`);

        for (const launcher of [chromium, firefox, webkit]) {
            const result = await runBenchmark(
                launcher,
                filterList,
                benchmarkConfig.parserOptions,
                agtreeIife,
                objectSizeofIife,
            );

            if (result) {
                consola.success(`Benchmark results for ${launcher.name()}`);
                printResults(result);
            }

            console.log();
        }
    }
})());
