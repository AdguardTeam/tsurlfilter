/**
 * @file Benchmark runner.
 */
import { type Browser, type BrowserType } from 'playwright';

import { type ParserOptions } from '../src/parser/options';
import { type DownloadedFilterListResource } from './interfaces';
import { benchmark, type BenchmarkArgs, type BenchmarkResult } from './benchmark-code';

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
export const runBenchmarkBrowser = async (
    browserLauncher: BrowserType,
    filterList: DownloadedFilterListResource,
    agtreeParserOptions: ParserOptions,
    agtreeIife: string,
    objectSizeofIife: string,
): Promise<BenchmarkResult | Error> => {
    let browser: Browser | null = null;

    try {
        browser = await browserLauncher.launch();
        const context = await browser.newContext();
        const page = await context.newPage();

        // These modules requires pre-building
        await page.addScriptTag({ content: agtreeIife });
        await page.addScriptTag({ content: objectSizeofIife });
        // These modules can be used directly from 'node_modules'
        await page.addScriptTag({ path: '../node_modules/lodash/lodash.js' });
        await page.addScriptTag({ path: '../node_modules/benchmark/benchmark.js' });

        // Display console logs, if any
        page.on('console', (message) => {
            // eslint-disable-next-line no-console
            console.log('PAGE LOG:', message.text());
        });

        // Evaluate the benchmark in the browser
        const resultWithoutBrowser = await page.evaluate(
            benchmark,
            {
                rawFilterList: filterList.contents,
                agtreeParserOptions,
            } as BenchmarkArgs,
        );

        await page.close();
        await browser.close();

        return {
            ...resultWithoutBrowser,
            environment: browser.browserType().name(),
            environmentVersion: browser.version(),
        };
    } catch (error) {
        if (browser !== null) {
            await browser.close();
        }

        if (error instanceof Error) {
            return error;
        }

        throw new Error(`Unknown error: ${error}`);
    }
};
