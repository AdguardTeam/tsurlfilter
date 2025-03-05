/**
 * @file Interface definitions for the benchmark.
 */

import { type ParserOptions } from '@adguard/agtree/parser';

import { type BenchmarkResult } from './benchmark-code';

/**
 * Filter list resource.
 */
export interface FilterListResource {
    /**
     * Filter list name.
     */
    name: string;

    /**
     * Filter list URL.
     */
    url: string;
}

export interface DownloadedFilterListResource extends FilterListResource {
    /**
     * Filter list contents.
     */
    contents: string;
}

/**
 * Filter list benchmark result.
 */
export interface FilterListBenchmarkResult {
    /**
     * Filter list name.
     */
    name: string;

    /**
     * Benchmark results for each browser.
     */
    results: BenchmarkResult[];
}

/**
 * Benchmark configuration.
 */
export interface BenchmarkConfig {
    /**
     * Filter lists to benchmark.
     */
    filterLists: FilterListResource[];

    /**
     * AGTree parser options to use when parsing the filter lists in the benchmark.
     */
    parserOptions: ParserOptions;
}
