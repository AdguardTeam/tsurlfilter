/* eslint-disable func-names */
/**
 * @file Benchmark a resource
 */

import Benchmark from 'benchmark';

import { type TokenizerConfigs, type Resource, type TokenizerBenchResult } from '../common/interfaces';

// Extend the Benchmark.Stats interface with a new property
declare module 'benchmark' {
    interface Stats {
        tokens?: number;
    }
}

const MS = 'ms';
const N_A = 'N/A';
const NAN = 'NaN';
const PERCENT = '%';
const PLUS_MINUS = '\xb1';

const EVENT_COMPLETE = 'complete';

/**
 * Benchmarks a resource with the given tokenizers
 *
 * @param resource Resource to benchmark
 * @param tokenizerConfigs Tokenizer configs to benchmark
 * @returns Benchmark results for each tokenizer on the resource
 */
export const benchmarkResource = (resource: Resource, tokenizerConfigs: TokenizerConfigs): TokenizerBenchResult[] => {
    const results: TokenizerBenchResult[] = [];

    // Create a new benchmark suite
    // https://benchmarkjs.com/docs/#Suite
    const suite = new Benchmark.Suite();

    for (const [name, config] of Object.entries(tokenizerConfigs)) {
        // https://benchmarkjs.com/docs/#Suite_prototype_add
        suite.add(
            name,
            function (this: Benchmark) {
                // Add tokens count to the benchmark stats, this is binded to the benchmark
                this.stats.tokens = config.tokenize(resource.content);
            },
        );
    }

    // TODO: Add a progress bar, if possible and doesn't affect the performance
    // https://benchmarkjs.com/docs/#prototype_on
    // suite.on('cycle', function (event: Benchmark.Event) {
    //     // ...
    // });

    // https://benchmarkjs.com/docs/#prototype_on
    suite.on(EVENT_COMPLETE, function (this: Benchmark.Suite) {
        // Sort the benchmarks by performance (fastest first)
        this.sort((a, b) => b.hz - a.hz);

        // Iterate over the benchmarks and save the results
        results.push(
            ...this.map((bench: Benchmark) => {
                // Some calculations here based on the Benchmark.js source code:
                // https://github.com/bestiejs/benchmark.js/blob/42f3b732bac3640eddb3ae5f50e445f3141016fd/benchmark.js#L1525
                const name = bench.name || (Number.isNaN(bench.id) ? NAN : `benchmark #${bench.id}`);

                return ({
                    tokenizerName: name,
                    // eslint-disable-next-line max-len
                    opsPerSecond: `${bench.hz.toFixed(bench.hz < 100 ? 2 : 0)} (${PLUS_MINUS}${bench.stats.rme.toFixed(2)}${PERCENT})`,
                    runsSampled: bench.stats.sample.length,
                    // https://benchmarkjs.com/docs/#stats_mean (The sample arithmetic mean (secs))
                    averageRuntime: `${(bench.stats.mean * 1000).toFixed(10)} ${MS}`,
                    tokens: bench.stats.tokens || N_A,
                    status: bench.error ? 'failed' : 'no errors',
                } as TokenizerBenchResult);
            }),
        );
    });

    // Run the benchmark suite for the current resource
    // https://benchmarkjs.com/docs/#Suite_prototype_run
    suite.run();

    return results;
};
