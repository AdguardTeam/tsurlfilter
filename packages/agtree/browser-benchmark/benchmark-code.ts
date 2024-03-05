/* eslint-disable func-names */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Benchmark code to be run in the browser.
 */

import Benchmark from 'benchmark';
import ObjectSizeof from 'object-sizeof';
import path from 'path';
import { fileURLToPath } from 'url';

import type * as AGTree from '../src/index';
import { type ParserOptions } from '../src/parser/options';

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

    /**
     * Size of the serialized filter list in bytes (how much space it takes in the byte buffer).
     */
    serializedFilterListSize: number;

    /**
     * Size of the deserialized filter list AST in bytes.
     *
     * @note It may be different from the parsed filter list size, because serialization may drop some data,
     * like raws.
     */
    deserializedFilterListSize: number;
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
 * @param root0.ObjectSizeof ObjectSizeof library.
 * @param root0.Benchmark Benchmark.js library.
 * @param root0.AGTree AGTree library.
 * @returns Benchmark results.
 */
export const benchmark = async (
    {
        rawFilterList, agtreeParserOptions,
    }: BenchmarkArgs,
): Promise<BenchmarkResultWithoutEnv> => {
    let agTreeModule: typeof AGTree;
    let benchmarkJsModule: typeof Benchmark;
    let objectSizeofModule: typeof ObjectSizeof;

    if (typeof window !== 'undefined') {
        // browser environment
        agTreeModule = window.AGTree;
        benchmarkJsModule = window.Benchmark;
        objectSizeofModule = window.ObjectSizeof;
    } else {
        // Node.js environment
        agTreeModule = await import(path.join(__dirname, 'temp/agtree-node.js'));
        benchmarkJsModule = Benchmark;
        objectSizeofModule = ObjectSizeof;
    }

    // ----

    // // quick tests for text encoding & decoding
    // const ITERS = 100;
    // const LEN = 30;

    // const getTestStringSlice = (str: string, chars: number, iter: number): string => {
    //     if (chars > str.length) {
    //         // repeat the string until it reaches the desired length
    //         return str.repeat(Math.ceil(chars / str.length)).slice(0, chars);
    //     }

    //     const start = (iter * chars) % str.length;

    //     if (start + chars < str.length) {
    //         return str.slice(start, start + chars);
    //     }

    //     return str.slice(start) + str.slice(0, chars - (str.length - start));
    // };

    // // console.log(getTestStringSlice(rawFilterList, 100, 99));

    // const nativeEncoding = () => {
    //     const times: number[] = [];
    //     const te = new TextEncoder();
    //     for (let i = 0; i < ITERS; i += 1) {
    //         const str = getTestStringSlice(rawFilterList, LEN, i);
    //         const startT = performance.now();
    //         te.encode(str);
    //         times.push(performance.now() - startT);
    //     }
    //     console.log('Native encoding', times.reduce((a, b) => a + b, 0.0) / times.length, 'ms');
    // };

    // const nativeDecoding = () => {
    //     const times: number[] = [];
    //     const td = new TextDecoder();
    //     const te = new TextEncoder();
    //     for (let i = 0; i < ITERS; i += 1) {
    //         const encoded = te.encode(getTestStringSlice(rawFilterList, LEN, i));
    //         const startT = performance.now();
    //         td.decode(encoded);
    //         times.push(performance.now() - startT);
    //     }
    //     console.log('Native decoding', times.reduce((a, b) => a + b, 0.0) / times.length, 'ms');
    // };

    // const agtreeEncoding = () => {
    //     const times: number[] = [];
    //     const outBuffer = new agTreeModule.OutputByteBuffer();
    //     for (let i = 0; i < ITERS; i += 1) {
    //         const str = getTestStringSlice(rawFilterList, LEN, i);
    //         const startT = performance.now();
    //         outBuffer.writeString(str);
    //         times.push(performance.now() - startT);
    //     }
    //     console.log('AGTree encoding', times.reduce((a, b) => a + b, 0.0) / times.length, 'ms');
    // };

    // const agtreeDecoding = () => {
    //     const times: number[] = [];
    //     for (let i = 0; i < ITERS; i += 1) {
    //         const str = getTestStringSlice(rawFilterList, LEN, i);
    //         const outBuffer = new agTreeModule.OutputByteBuffer();
    //         outBuffer.writeString(str);
    //         const inBuffer = new agTreeModule.InputByteBuffer((outBuffer as any).byteBuffer.chunks);
    //         const startT = performance.now();
    //         inBuffer.readString();
    //         times.push(performance.now() - startT);
    //     }
    //     console.log('AGTree decoding', times.reduce((a, b) => a + b, 0.0) / times.length, 'ms');
    // };

    // const agtreeDecoding2 = () => {
    //     const times: number[] = [];
    //     for (let i = 0; i < ITERS; i += 1) {
    //         const str = getTestStringSlice(rawFilterList, LEN, i);
    //         const outBuffer = new agTreeModule.OutputByteBuffer2();
    //         outBuffer.writeString(str);
    //         const inBuffer = new agTreeModule.InputByteBuffer2((outBuffer as any).byteBuffer.chunks);
    //         const startT = performance.now();
    //         inBuffer.readString();
    //         times.push(performance.now() - startT);
    //     }
    //     console.log('AGTree decoding (new)', times.reduce((a, b) => a + b, 0.0) / times.length, 'ms');
    // };

    // nativeEncoding();
    // nativeDecoding();

    // agtreeEncoding();
    // agtreeDecoding();
    // agtreeDecoding2();

    // ----

    const node = agTreeModule.FilterListParser.parse(rawFilterList, agtreeParserOptions);

    const outBuffer = new agTreeModule.OutputByteBuffer();
    agTreeModule.FilterListParser.serialize(node, outBuffer);
    const inBuffer = new agTreeModule.InputByteBuffer((outBuffer as any).byteBuffer.chunks);
    const deserializedNode = {} as AGTree.FilterList;
    agTreeModule.FilterListParser.deserialize(inBuffer, deserializedNode);

    // serialize with OutputByteBuffer2
    const outBuffer2 = new agTreeModule.OutputByteBuffer2();
    agTreeModule.FilterListParser.serialize(node, outBuffer2);

    const stats = {
        rawFilterListSize: new Blob([rawFilterList]).size,
        parsedFilterListSize: objectSizeofModule(node),
        serializedFilterListSize: (outBuffer as any).offset,
        deserializedFilterListSize: objectSizeofModule(deserializedNode),
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

    suite.add('Serialize AST to byte buffer', () => {
        const tmpOutBuffer = new agTreeModule.OutputByteBuffer();
        agTreeModule.FilterListParser.serialize(node, tmpOutBuffer);
    });

    suite.add('Deserialize byte buffer to AST', () => {
        const tmpInBuffer = new agTreeModule.InputByteBuffer((outBuffer as any).byteBuffer.chunks);
        const tmpDeserializedNode = {} as AGTree.FilterList;
        agTreeModule.FilterListParser.deserialize(tmpInBuffer, tmpDeserializedNode);
    });

    suite.add('Deserialize byte buffer to AST (InputByteBuffer2)', () => {
        const tmpInBuffer = new agTreeModule.InputByteBuffer2((outBuffer2 as any).byteBuffer.chunks);
        const tmpDeserializedNode = {} as AGTree.FilterList;
        agTreeModule.FilterListParser.deserialize(tmpInBuffer, tmpDeserializedNode);
    });

    suite.add('Deserialize byte buffer to AST (InputByteBuffer3)', () => {
        const tmpInBuffer = new agTreeModule.InputByteBuffer3((outBuffer2 as any).byteBuffer.chunks);
        const tmpDeserializedNode = {} as AGTree.FilterList;
        agTreeModule.FilterListParser.deserialize(tmpInBuffer, tmpDeserializedNode);
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
