/**
 * @file Benchmark runner.
 */
import { type ParserOptions } from '../src/parser/options';
import { type DownloadedFilterListResource } from './interfaces';
import { benchmark, type BenchmarkArgs, type BenchmarkResult } from './benchmark-code';

/**
 * Run the benchmark in the given browser.
 *
 * @param filterList Filter list resource to benchmark.
 * @param agtreeParserOptions AGTree parser options.
 * @returns Benchmark results or null if an error occurred.
 */
export const runBenchmarkNode = async (
    filterList: DownloadedFilterListResource,
    agtreeParserOptions: ParserOptions,
): Promise<BenchmarkResult | Error> => {
    try {
        // Evaluate the benchmark in the browser
        const baseResult = await benchmark({
            rawFilterList: filterList.contents,
            agtreeParserOptions,
        } as BenchmarkArgs);

        return {
            ...baseResult,
            environment: 'Node.js',
            environmentVersion: process.version,
        };
    } catch (error) {
        if (error instanceof Error) {
            return error;
        }

        throw new Error(`Unknown error: ${error}`);
    }
};
