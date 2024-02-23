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

export interface BenchmarkResultSummary {
    rawFilterListSize: number;
    parsedFilterListSize: number;
    serializedFilterListSize: number;
    deserializedFilterListSize: number;
    results: BenchmarkJsResult[];
}

export const pageContextBenchmark = async (
    { rawFilterList, agtreeParserOptions }: PageContextBenchmarkArgs,
): Promise<any> => {
    const MS = 'ms';
    const NAN = 'NaN';
    const PERCENT = '%';
    const PLUS_MINUS = '\xb1';

    const EVENT_COMPLETE = 'complete';

    const { AGTree, Benchmark, ObjectSizeof } = window;

    const suite = new Benchmark.Suite();
    const node = AGTree.FilterListParser.parse(rawFilterList, agtreeParserOptions);

    suite.add('Parse string to AST', () => {
        AGTree.FilterListParser.parse(rawFilterList, agtreeParserOptions);
    });

    suite.add('Clone AST to AST', () => {
        structuredClone(node);
    });

    suite.add('Serialize AST to byte buffer', () => {
        const outBuffer = new AGTree.OutputByteBuffer();
        AGTree.FilterListParser.serialize(node, outBuffer);
    });

    const outBuffer = new AGTree.OutputByteBuffer();
    AGTree.FilterListParser.serialize(node, outBuffer);

    suite.add('Deserialize byte buffer to AST', () => {
        const inBuffer = new AGTree.InputByteBuffer((outBuffer as any).byteBuffer.chunks);
        const deserializedNode = {} as AGTree.FilterList;
        AGTree.FilterListParser.deserialize(inBuffer, deserializedNode);
    });

    const result: BenchmarkResultSummary = {
        results: [],
        rawFilterListSize: 0,
        parsedFilterListSize: 0,
        serializedFilterListSize: 0,
        deserializedFilterListSize: 0,
    };

    // https://benchmarkjs.com/docs/#prototype_on
    suite.on(EVENT_COMPLETE, function (this: Benchmark.Suite) {
        // Sort the benchmarks by performance (fastest first)
        this.sort((a, b) => b.hz - a.hz);

        // Iterate over the benchmarks and save the results
        result.results.push(
            ...this.map((bench: Benchmark) => {
                // Some calculations here based on the Benchmark.js source code:
                // https://github.com/bestiejs/benchmark.js/blob/42f3b732bac3640eddb3ae5f50e445f3141016fd/benchmark.js#L1525
                const name = bench.name || (Number.isNaN(bench.id) ? NAN : `benchmark #${bench.id}`);

                return ({
                    toolName: name,
                    // eslint-disable-next-line max-len
                    opsPerSecond: `${bench.hz.toFixed(bench.hz < 100 ? 2 : 0)} (${PLUS_MINUS}${bench.stats.rme.toFixed(2)}${PERCENT})`,
                    runsSampled: bench.stats.sample.length,
                    // https://benchmarkjs.com/docs/#stats_mean (The sample arithmetic mean (secs))
                    averageRuntime: `${(bench.stats.mean * 1000).toFixed(10)} ${MS}`,
                    status: bench.error ? 'failed' : 'no errors',
                });
            }),
        );
    });

    suite.run();

    result.rawFilterListSize = new Blob([rawFilterList]).size;
    result.parsedFilterListSize = ObjectSizeof(node);
    result.serializedFilterListSize = (outBuffer as any).offset;
    const inBuffer = new AGTree.InputByteBuffer((outBuffer as any).byteBuffer.chunks);
    const deserializedNode = {} as AGTree.FilterList;
    AGTree.FilterListParser.deserialize(inBuffer, deserializedNode);
    result.deserializedFilterListSize = ObjectSizeof(deserializedNode);

    return result;
};
