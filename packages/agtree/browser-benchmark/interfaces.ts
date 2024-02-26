/**
 * @file Interface definitions for the benchmark.
 */

import { type ParserOptions } from '../src/parser/options';

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

    /**
     * Filter list contents (if not specified, it will be fetched from the URL).
     */
    raw?: string;
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
