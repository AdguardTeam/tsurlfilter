/* eslint-disable func-names */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type Benchmark from 'benchmark';
import type ObjectSizeof from 'object-sizeof';

import type * as AGTree from '../src/index';
import { type ParserOptions } from '../src/parser/options';

declare global {
    interface Window {
        AGTree: typeof AGTree;
        Benchmark: typeof Benchmark;
        ObjectSizeof: typeof ObjectSizeof;
    }
}

export interface PageContextBenchmarkArgs {
    rawFilterList: string;
    agtreeParserOptions: ParserOptions;
}

interface BenchmarkJsResult {
    toolName: string;
    opsPerSecond: string;
    runsSampled: number;
    averageRuntime: string;
    status: string;
}

interface PageContextStats {
    rawFilterListSize: number;
    parsedFilterListSize: number;
    serializedFilterListSize: number;
    deserializedFilterListSize: number;
}

export interface PageContextBenchmarkResults {
    stats: PageContextStats;
    results: BenchmarkJsResult[];
}

export const pageContextBenchmark = async (
    { rawFilterList, agtreeParserOptions }: PageContextBenchmarkArgs,
): Promise<any> => {
    const { AGTree, Benchmark, ObjectSizeof } = window;

    const node = AGTree.FilterListParser.parse(rawFilterList, agtreeParserOptions);

    const outBuffer = new AGTree.OutputByteBuffer();
    AGTree.FilterListParser.serialize(node, outBuffer);
    const inBuffer = new AGTree.InputByteBuffer((outBuffer as any).byteBuffer.chunks);
    const deserializedNode = {} as AGTree.FilterList;
    AGTree.FilterListParser.deserialize(inBuffer, deserializedNode);

    const stats = {
        rawFilterListSize: new Blob([rawFilterList]).size,
        parsedFilterListSize: ObjectSizeof(node),
        serializedFilterListSize: (outBuffer as any).offset,
        deserializedFilterListSize: ObjectSizeof(deserializedNode),
    };

    const result: PageContextBenchmarkResults = {
        results: [],
        stats,
    };

    const suite = new Benchmark.Suite();

    suite.add('Parse string to AST', () => {
        AGTree.FilterListParser.parse(rawFilterList, agtreeParserOptions);
    });

    suite.add('Clone AST to AST', () => {
        structuredClone(node);
    });

    suite.add('Serialize AST to byte buffer', () => {
        const tmpOutBuffer = new AGTree.OutputByteBuffer();
        AGTree.FilterListParser.serialize(node, tmpOutBuffer);
    });

    suite.add('Deserialize byte buffer to AST', () => {
        const tmpInBuffer = new AGTree.InputByteBuffer((outBuffer as any).byteBuffer.chunks);
        const tmpDeserializedNode = {} as AGTree.FilterList;
        AGTree.FilterListParser.deserialize(tmpInBuffer, tmpDeserializedNode);
    });

    suite.on('complete', function (this: Benchmark.Suite) {
        // Sort the benchmarks by performance (fastest first)
        this.sort((a, b) => b.hz - a.hz);

        // Iterate over the benchmarks and save the results
        result.results.push(
            ...this.map((bench: Benchmark) => {
                // Some calculations here based on the Benchmark.js source code:
                // https://github.com/bestiejs/benchmark.js/blob/42f3b732bac3640eddb3ae5f50e445f3141016fd/benchmark.js#L1525
                const name = bench.name || (Number.isNaN(bench.id) ? 'NaN' : `benchmark #${bench.id}`);

                return ({
                    toolName: name,
                    opsPerSecond: `${bench.hz.toFixed(bench.hz < 100 ? 2 : 0)} (\xb1${bench.stats.rme.toFixed(2)}%)`,
                    runsSampled: bench.stats.sample.length,
                    // https://benchmarkjs.com/docs/#stats_mean (The sample arithmetic mean (secs))
                    averageRuntime: `${(bench.stats.mean * 1000).toFixed(10)} ms`,
                    status: bench.error ? 'failed' : 'passed',
                });
            }),
        );
    });

    suite.run();

    return result;
};
