/**
 * @file Interfaces for the benchmarking script
 */

/**
 * Tokenizer config interface
 */
interface TokenizerConfig {
    /**
     * URL to the tokenizer
     */
    url: string;

    /**
     * Function to tokenize CSS
     *
     * @param css CSS to tokenize
     *
     * @returns Token count
     */
    tokenize: (css: string) => number;
}

/**
 * Tokenizers configs record
 */
export type TokenizerConfigs = Record<string, TokenizerConfig>;

/**
 * Resource config interface
 */
interface ResourceConfig {
    /**
     * URL to the resource
     */
    url: string;

    /**
     * Whether the resource is an adblock list (and not just a plain CSS file)
     */
    adblock?: boolean;
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
 * Benchmark result data for a single tokenizer
 */
export type TokenizerBenchResult = {
    /**
     * Tokenizer name
     */
    tokenizerName: string;

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
     * Token count produced by the tokenizer
     */
    tokens: number | string;

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
     * Tokenizer benchmark results for the resource
     */
    tokenizerBenchResults: TokenizerBenchResult[];
};
