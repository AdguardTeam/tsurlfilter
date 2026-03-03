/* eslint-disable func-names */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Benchmark code.
 */

import Benchmark from 'benchmark';
import ObjectSizeof from 'object-sizeof';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as AGTree from '@adguard/agtree';
import { type ParserOptions } from '@adguard/agtree/parser';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Extend the global window object with the necessary types.
declare global {
    interface Window {
        AGTree: typeof AGTree;
        Benchmark: typeof Benchmark;
        ObjectSizeof: typeof ObjectSizeof;
        benchmark: typeof benchmark;
    }
}

/**
 * Interface for the benchmark arguments.
 */
export interface BenchmarkArgs {
    /**
     * Raw filter list contents to benchmark.
     */
    rawFilterList: string;

    /**
     * AGTree parser options to use when parsing the filter list.
     */
    agtreeParserOptions: ParserOptions;

    /**
     * ObjectSizeof library.
     */
    objectSizeofModule: typeof ObjectSizeof;

    /**
     * Benchmark library.
     */
    benchmarkJsModule: typeof Benchmark;

    /**
     * AGTree library.
     */
    agTreeModule: typeof AGTree;
}

/**
 * Interface for the Benchmark.js result.
 */
interface BenchmarkJsResult {
    /**
     * Action name.
     */
    actionName: string;

    /**
     * Operations per second.
     */
    opsPerSecond: string;

    /**
     * Number of runs sampled.
     */
    runsSampled: number;

    /**
     * Average runtime of the action in milliseconds.
     */
    averageRuntime: string;

    /**
     * Status of the action ('passed' or 'failed').
     */
    status: string;
}

/**
 * Interface for the stats.
 */
interface BenchmarkStats {
    /**
     * Size of the raw filter list in bytes.
     */
    rawFilterListSize: number;

    /**
     * Size of the parsed filter list AST in bytes.
     */
    parsedFilterListSize: number;
}

/**
 * Interface for the benchmark results.
 */
export interface BenchmarkResult {
    /**
     * Environment name.
     */
    environment: string;

    /**
     * Environment version.
     */
    environmentVersion: string;

    /**
     * Stats.
     */
    stats: BenchmarkStats;

    /**
     * Benchmark results.
     */
    benchmarkJsResults: BenchmarkJsResult[];
}

export type BenchmarkResultWithoutEnv = Omit<BenchmarkResult, 'environment' | 'environmentVersion'>;

/**
 * Benchmark code to be run in the browser.
 *
 * @param root0 Arguments.
 * @param root0.rawFilterList Raw filter list contents to benchmark.
 * @param root0.agtreeParserOptions AGTree parser options to use when parsing the filter list.
 * @returns Benchmark results.
 */
export const benchmark = async ({
    rawFilterList,
    agtreeParserOptions,
}: BenchmarkArgs): Promise<BenchmarkResultWithoutEnv> => {
    let agTreeModule: typeof AGTree;
    let benchmarkJsModule: typeof Benchmark;
    let objectSizeofModule: typeof ObjectSizeof;

    if (typeof window === 'undefined') {
        // Node.js environment
        agTreeModule = await import(path.join(__dirname, 'temp/agtree-node.js'));
        benchmarkJsModule = Benchmark;
        objectSizeofModule = ObjectSizeof;
    } else {
        // browser environment
        agTreeModule = window.AGTree;
        benchmarkJsModule = window.Benchmark;
        objectSizeofModule = window.ObjectSizeof;
    }

    const node = agTreeModule.FilterListParser.parse(rawFilterList, agtreeParserOptions);

    const stats = {
        rawFilterListSize: new Blob([rawFilterList]).size,
        parsedFilterListSize: objectSizeofModule(node),
    };

    const result: BenchmarkResultWithoutEnv = {
        benchmarkJsResults: [],
        stats,
    };

    const suite = new benchmarkJsModule.Suite();

    suite.add('Parse string to AST', () => {
        agTreeModule.FilterListParser.parse(rawFilterList, agtreeParserOptions);
    });

    suite.add('Clone AST to AST with structuredClone', () => {
        structuredClone(node);
    });

    suite.on('complete', function (this: Benchmark.Suite) {
        // Sort the benchmarks by performance (fastest first)
        this.sort((a, b) => b.hz - a.hz);

        // Iterate over the benchmarks and save the results
        result.benchmarkJsResults.push(
            ...this.map((bench: Benchmark): BenchmarkJsResult => {
                // Some calculations here based on the Benchmark.js source code:
                // https://github.com/bestiejs/benchmark.js/blob/42f3b732bac3640eddb3ae5f50e445f3141016fd/benchmark.js#L1525
                const name = bench.name || (Number.isNaN(bench.id) ? 'NaN' : `benchmark #${bench.id}`);

                return ({
                    actionName: name,
                    opsPerSecond: `${bench.hz.toFixed(bench.hz < 100 ? 2 : 0)} (\xb1${bench.stats.rme.toFixed(2)}%)`,
                    runsSampled: bench.stats.sample.length,
                    // https://benchmarkjs.com/docs/#stats_mean (The sample arithmetic mean (secs))
                    averageRuntime: `${(bench.stats.mean * 1000).toFixed(10)} ms`,
                    status: bench.error ? bench.error.message : 'passed',
                });
            }),
        );
    });

    suite.run();

    return result;
};
