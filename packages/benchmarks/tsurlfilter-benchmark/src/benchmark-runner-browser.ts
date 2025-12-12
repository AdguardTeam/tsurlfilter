/**
 * @file Benchmark runner.
 */
import { type Browser, type BrowserType } from 'playwright';

import { type DownloadedFilterListResource } from './interfaces';
import { benchmark, type BenchmarkArgs, type BenchmarkResult } from './benchmark-code';

/**
 * Run the benchmark in the given browser.
 *
 * @param browserLauncher Browser launcher to use.
 * @param filterList Filter list resource to benchmark.
 * @param tsurlfilterIife tsurlfilter IIFE code to be injected into the browser.
 * @param tsurlfilterV3Iife tsurlfilter-v3 IIFE code to be injected into the browser.
 * @param tinybenchIife tinybench IIFE code to be injected into the browser.
 * @returns Benchmark results or null if an error occurred.
 */
export const runBenchmarkBrowser = async (
    browserLauncher: BrowserType,
    filterList: DownloadedFilterListResource,
    tsurlfilterIife: string,
    tsurlfilterV3Iife: string,
    tinybenchIife: string,
): Promise<BenchmarkResult | Error> => {
    let browser: Browser | null = null;

    try {
        browser = await browserLauncher.launch();
        const context = await browser.newContext();
        const page = await context.newPage();

        // These modules requires pre-building
        await page.addScriptTag({ content: tsurlfilterIife });
        await page.addScriptTag({ content: tsurlfilterV3Iife });
        await page.addScriptTag({ content: tinybenchIife });

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
