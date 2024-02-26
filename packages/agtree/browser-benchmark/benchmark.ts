/* eslint-disable no-console */
// Usage: npx tsx benchmark.ts

import {
    type Browser,
    chromium,
    firefox,
    webkit,
    type BrowserType,
} from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

import { type ParserOptions } from '../src/parser/options';
import {
    type BenchmarkResultSummary,
    pageContextBenchmark,
    type PageContextBenchmarkArgs,
} from './page-context-benchmark';
import { buildIife } from './helpers/build-iife';
import { benchmarkConfig } from './config';
import { type FilterList } from './interfaces';
import { fetchFile } from './helpers/fetch-file';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const benchmarkBrowser = async (
    browserLauncher: BrowserType,
    filterLists: FilterList[],
    agtreeIife: string,
    objectSizeofIife: string,
    agtreeParserOptions: ParserOptions,
): Promise<BenchmarkResultSummary | null> => {
    console.log(`Launching ${browserLauncher.name()}`);

    let browser: Browser | null = null;

    try {
        browser = await browserLauncher.launch();
        console.log(`Version: ${browser.version()}`);
        const context = await browser.newContext();

        let result: BenchmarkResultSummary | null = null;

        for (const filterList of filterLists) {
            console.log(`Benchmarking ${filterList.name}`);
            const page = await context.newPage();

            await page.addScriptTag({ content: agtreeIife });
            await page.addScriptTag({ content: objectSizeofIife });
            await page.addScriptTag({ path: '../node_modules/lodash/lodash.js' });
            await page.addScriptTag({ path: '../node_modules/benchmark/benchmark.js' });

            result = await page.evaluate(
                pageContextBenchmark,
                {
                    rawFilterList: filterList.raw,
                    agtreeParserOptions,
                } as PageContextBenchmarkArgs,
            );

            await page.close();
        }

        await browser.close();

        return result;
    } catch (error) {
        if (browser !== null) {
            await browser.close();
        }

        console.error(error);

        return null;
    }
};

const downloadFilterLists = async (filterLists: FilterList[]): Promise<void> => {
    for (const filterList of filterLists) {
        // skip if already downloaded
        if (filterList.raw) {
            continue;
        }

        const raw = await fetchFile(filterList.url);
        filterList.raw = raw;
    }
};

((async () => {
    console.log('Starting the benchmark');

    console.log('Downloading filter lists...');
    await downloadFilterLists(benchmarkConfig.filterLists);

    console.log('Building AGTree IIFE...');
    const agtreeIife = await buildIife(
        path.join(__dirname, '../src/index.ts'),
        'AGTree',
    );

    console.log('Building object-sizeof IIFE...');
    const objectSizeofIife = await buildIife(
        path.join(__dirname, '../node_modules/object-sizeof/index.js'),
        'ObjectSizeof',
    );

    console.log('Benchmarking...');
    for (const launcher of [chromium, firefox, webkit]) {
        const result = await benchmarkBrowser(
            launcher,
            benchmarkConfig.filterLists,
            agtreeIife,
            objectSizeofIife,
            benchmarkConfig.parserOptions,
        );

        if (result) {
            console.table(result.results);

            // sizes
            console.log(`- Raw filter list size (MB): ${(result.rawFilterListSize / 1024 / 1024).toFixed(2)}`);
            // eslint-disable-next-line max-len
            console.log(`- Parsed filter list AST size (MB): ${(result.parsedFilterListSize / 1024 / 1024).toFixed(2)}`);
            console.log(`- Serialized size (MB): ${(result.serializedFilterListSize / 1024 / 1024).toFixed(2)}`);
            // eslint-disable-next-line max-len
            console.log(`- Deserialized filter list AST size (MB): ${(result.deserializedFilterListSize / 1024 / 1024).toFixed(2)}`);
        }

        console.log();
    }
})());
