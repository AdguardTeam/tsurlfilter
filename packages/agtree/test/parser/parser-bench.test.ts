import Benchmark from 'benchmark';
import { Table } from 'console-table-printer';

import { defaultParserOptions } from '../../src/parser/options';
import { FilterListParser } from '../../src/parser/filterlist';
import { OutputByteBuffer } from '../../src/utils/output-byte-buffer';
import { OutputByteBuffer2 } from '../../src/utils/output-byte-buffer2';
import { InputByteBuffer } from '../../src/utils/input-byte-buffer';
import { InputByteBuffer2 } from '../../src/utils/input-byte-buffer2';
import { type FilterList } from '../../src/parser/common';

describe('Benchmark parse/serialize', () => {
    it('Benchmark parse/serialize', async () => {
        const response = await fetch('https://easylist.to/easylist/easylist.txt');
        const rawFilterList = await response.text();

        const parserOptions = {
            ...defaultParserOptions,
            tolerant: true,
            isLocIncluded: false,
            ignoreComments: true,
            parseRaws: false,
        };

        // Prepare the serialized filter list for the test.
        const node = FilterListParser.parse(rawFilterList, parserOptions);
        const outBuffer = new OutputByteBuffer();
        FilterListParser.serialize(node, outBuffer);

        const outBuffer2 = new OutputByteBuffer2();
        FilterListParser.serialize(node, outBuffer2);

        FilterListParser.deserialize(new InputByteBuffer2((outBuffer2 as any).byteBuffer.chunks), {} as FilterList);

        const suite = new Benchmark.Suite();

        suite.add('FilterListParser.parse', () => {
            FilterListParser.parse(rawFilterList, parserOptions);
        });

        suite.add('deserialize old decoder', () => {
            const inBuffer = new InputByteBuffer((outBuffer as any).byteBuffer.chunks);
            const tmpDeserializedNode = {} as FilterList;
            FilterListParser.deserialize(inBuffer, tmpDeserializedNode);
        });

        suite.add('deserialize new decoder', () => {
            const inBuffer2 = new InputByteBuffer2((outBuffer2 as any).byteBuffer.chunks);
            const tmpDeserializedNode = {} as FilterList;
            FilterListParser.deserialize(inBuffer2, tmpDeserializedNode);
        });

        // Run the benchmark suite for the current resource
        // https://benchmarkjs.com/docs/#Suite_prototype_run
        suite.run();

        // Sort the benchmarks by performance (fastest first)
        suite.sort((a, b) => b.hz - a.hz);

        const results = suite.map((bench: Benchmark) => {
            // Some calculations here based on the Benchmark.js source code:
            // https://github.com/bestiejs/benchmark.js/blob/42f3b732bac3640eddb3ae5f50e445f3141016fd/benchmark.js#L1525
            const name = bench.name || (Number.isNaN(bench.id) ? 'NaN' : `benchmark #${bench.id}`);

            return ({
                name,
                opsPerSecond: `${bench.hz.toFixed(bench.hz < 100 ? 2 : 0)} (\xb1${bench.stats.rme.toFixed(2)}%)`,
                runsSampled: bench.stats.sample.length,
                // https://benchmarkjs.com/docs/#stats_mean (The sample arithmetic mean (secs))
                averageRuntime: `${(bench.stats.mean * 1000).toFixed(10)} ms`,
                status: bench.error ? 'failed' : 'passed',
            });
        });

        const table = new Table();

        for (const benchmarkResult of results) {
            table.addRow({
                'Benchmark name': benchmarkResult.name,
                'Ops/s': benchmarkResult.opsPerSecond,
                'Runs sampled': benchmarkResult.runsSampled,
                'Average runtime': benchmarkResult.averageRuntime,
                Status: benchmarkResult.status,
            });
        }

        table.printTable();
    });
});
