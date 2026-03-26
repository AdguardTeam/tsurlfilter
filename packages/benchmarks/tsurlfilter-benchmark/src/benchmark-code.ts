/* eslint-disable func-names */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Benchmark code.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Tinybench from 'tinybench';

import type * as TsUrlFilterV3 from './tsurlfilter/tsurlfilter-v3';
import type * as TsUrlFilter from './tsurlfilter/tsurlfilter';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Extend the global window object with the necessary types.
declare global {
    interface Window {
        TsUrlFilter: typeof TsUrlFilter;
        TsUrlFilterV3: typeof TsUrlFilterV3;
        Tinybench: typeof Tinybench;
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
}

/**
 * Interface for the Tinybench result.
 */
interface BenchmarkJsResult {
    /**
     * Task name.
     */
    name: string;

    /**
     * Operations per second (hz).
     */
    hz: number;

    /**
     * Minimum time (ms).
     */
    min: number;

    /**
     * Maximum time (ms).
     */
    max: number;

    /**
     * Mean/average time (ms).
     */
    mean: number;

    /**
     * 75th percentile (ms).
     */
    p75: number;

    /**
     * 99th percentile (ms).
     */
    p99: number;

    /**
     * 99.5th percentile (ms).
     */
    p995: number;

    /**
     * 99.9th percentile (ms).
     */
    p999: number;

    /**
     * Relative margin of error (%).
     */
    rme: number;

    /**
     * Number of samples.
     */
    samples: number;

    /**
     * Status of the task.
     */
    status: string;
}

/**
 * Interface for the stats.
 */
interface BenchmarkStats {
    /**
     * Number of rules in the engine.
     */
    rulesCount: number;

    /**
     * Number of rules in the engine v3.
     */
    rulesCountV3: number;
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
 * @returns Benchmark results.
 */
export const benchmark = async ({
    rawFilterList,
}: BenchmarkArgs): Promise<BenchmarkResultWithoutEnv> => {
    const ignoreCosmetic = false;

    let tinybenchModule: typeof Tinybench;
    let tsUrlFilterModule: typeof TsUrlFilter;
    let tsUrlFilterV3Module: typeof TsUrlFilterV3;

    if (typeof window === 'undefined') {
        // Node.js environment
        tsUrlFilterModule = await import(path.join(__dirname, 'tsurlfilter/tsurlfilter.js'));
        tsUrlFilterV3Module = await import(path.join(__dirname, 'tsurlfilter/tsurlfilter-v3.js'));
        tinybenchModule = await import('tinybench');
    } else {
        // browser environment
        tsUrlFilterModule = window.TsUrlFilter;
        tsUrlFilterV3Module = window.TsUrlFilterV3;
        tinybenchModule = window.Tinybench;
    }

    // Preprocess filter list once for v3 benchmarking
    // disable logging while preprocessing
    const originalInfo = tsUrlFilterV3Module.logger.info;
    tsUrlFilterV3Module.logger.info = () => {};
    const preprocessedFilter = tsUrlFilterV3Module.FilterListPreprocessor.preprocess(rawFilterList);
    tsUrlFilterV3Module.logger.info = originalInfo;

    // Create engines once to get stats
    const tsurlfilterEngine = await tsUrlFilterModule.Engine.createAsync({
        filters: [{
            id: 2,
            text: rawFilterList,
            ignoreCosmetic,
        }],
    });

    const v3List = new tsUrlFilterV3Module.BufferRuleList(
        1,
        preprocessedFilter.filterList,
        false,
        false,
        false,
        preprocessedFilter.sourceMap,
    );
    const v3Storage = new tsUrlFilterV3Module.RuleStorage([v3List]);
    const tsurlfilterV3Engine = new tsUrlFilterV3Module.Engine(v3Storage, true);
    tsurlfilterV3Engine.loadRules();

    const stats = {
        rulesCount: tsurlfilterEngine.getRulesCount(),
        rulesCountV3: tsurlfilterV3Engine.getRulesCount(),
    };

    const bench = new tinybenchModule.Bench();

    // Inline task logic to avoid closure serialization issues in browser
    bench.add('Create tsurlfilter v4 engine', async () => {
        const engine = await tsUrlFilterModule.Engine.createAsync({
            filters: [{
                id: 2,
                text: rawFilterList,
                ignoreCosmetic,
            }],
        });
        return engine;
    });

    bench.add('Create tsurlfilter v3 engine', () => {
        const list = new tsUrlFilterV3Module.BufferRuleList(
            1,
            preprocessedFilter.filterList,
            false,
            false,
            false,
            preprocessedFilter.sourceMap,
        );
        const storage = new tsUrlFilterV3Module.RuleStorage([list]);
        const engine = new tsUrlFilterV3Module.Engine(storage, true);
        engine.loadRules();
        return engine;
    });

    await bench.run();

    // Convert tinybench results to our format
    const benchmarkJsResults: BenchmarkJsResult[] = bench.tasks.map((task) => {
        const result = task.result as any;
        if (!result || result.state === 'aborted' || result.state === 'errored') {
            return {
                name: task.name,
                hz: 0,
                min: 0,
                max: 0,
                mean: 0,
                p75: 0,
                p99: 0,
                p995: 0,
                p999: 0,
                rme: 0,
                samples: 0,
                status: result?.error?.message || 'failed',
            };
        }

        // Tinybench result structure with all percentiles
        return {
            name: task.name,
            hz: result.throughput?.mean || 0,
            min: result.latency?.min || 0,
            max: result.latency?.max || 0,
            mean: result.latency?.mean || 0,
            p75: result.latency?.p75 || 0,
            p99: result.latency?.p99 || 0,
            p995: result.latency?.p995 || 0,
            p999: result.latency?.p999 || 0,
            rme: result.throughput?.rme || 0,
            samples: result.latency?.samplesCount || 0,
            status: 'passed',
        };
    });

    // Sort by performance (fastest first)
    benchmarkJsResults.sort((a, b) => b.hz - a.hz);

    return {
        benchmarkJsResults,
        stats,
    };
};
