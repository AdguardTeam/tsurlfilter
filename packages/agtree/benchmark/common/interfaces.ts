/**
 * @file Interfaces for the benchmarking script
 */

/**
 * Tool config interface
 */
interface ToolConfig {
    /**
     * URL to the tool
     */
    url: string;

    /**
     * Function to benchmark the tool
     *
     * @param source Source code to benchmark
     * @returns Result of the benchmark (typically, number of rules / tokens)
     */
    benchmark: (source: string) => number;
}

/**
 * Tool configs record
 */
export type ToolConfigs = Record<string, ToolConfig>;

/**
 * Resource config interface
 */
interface ResourceConfig {
    /**
     * URL to the resource
     */
    url: string;
}

/**
 * Resources configs record
 */
export type ResourceConfigs = Record<string, ResourceConfig>;

/**
 * Resource data (downloaded from the web)
 */
export interface Resource {
    /**
     * Name of the resource
     */
    name: string;

    /**
     * Resource content
     */
    content: string;
}

/**
 * Benchmark result data for a single tool
 */
export type ToolBenchResult = {
    /**
     * Tool name
     */
    toolName: string;

    /**
     * Operations per second
     */
    opsPerSecond: number | string;

    /**
     * How many times the benchmark was executed
     */
    runsSampled: number;

    /**
     * Average runtime in milliseconds / run
     */
    averageRuntime: string;

    /**
     * Processed data amount by the tool
     */
    result: number | string;

    /**
     * Run status (failed / no errors)
     */
    status: string;
};

/**
 * Benchmark results for a single resource. Key is the resource name, value is the benchmark results
 */
export type ResourceBenchResult = {
    /**
     * Resource name
     */
    resourceName: string;

    /**
     * Tool benchmark results for the resource
     */
    toolBenchResults: ToolBenchResult[];
};
