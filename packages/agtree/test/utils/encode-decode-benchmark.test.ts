import Benchmark from 'benchmark';
import { Table } from 'console-table-printer';

import { ByteBuffer } from '../../src/utils/byte-buffer';
import { encodeText } from '../../src/utils/text-encoder';
import { decodeText } from '../../src/utils/text-decoder';
import { decodeText2 } from '../../src/utils/text-decoder2';
import { decodeText3 } from '../../src/utils/text-decoder3';
import { encodeTextNew } from '../../src/utils/text-encoder-new';
import { decodeTextNew } from '../../src/utils/text-decoder-new';

describe('Benchmark decode/encode', () => {
    it('Benchmark decode', () => {
        const suite = new Benchmark.Suite();

        const str = 'abc'.repeat(10);
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const stringBytes = encoder.encode(str);

        // null-terminated
        const byteBuffer = new ByteBuffer();
        encodeText(str, byteBuffer, 0);

        // length + string
        const byteBufferNew = new ByteBuffer();
        encodeTextNew(str, byteBufferNew, 0);

        const byteBufferNew2 = new ByteBuffer();
        byteBufferNew2.writeString3(0, str);

        expect(decoder.decode(stringBytes)).toBe(str);
        expect(decodeText(byteBuffer, 0).decodedText).toBe(str);
        expect(decodeText2(byteBuffer, 0).decodedText).toBe(str);
        expect(decodeText3(byteBuffer, 0).decodedText).toBe(str);
        expect(byteBuffer.readString(0)).toBe(str);
        expect(byteBuffer.readString2(0)).toBe(str);
        expect(decodeTextNew(byteBufferNew, 0).decodedText).toBe(str);
        expect(byteBufferNew.readStringNew(0)).toBe(str);
        expect(byteBufferNew2.readString3(0)).toBe(str);

        suite.add('Native decoder', () => {
            decoder.decode(stringBytes);
        });

        suite.add('decodeText (first version)', () => {
            decodeText(byteBuffer, 0);
        });

        suite.add('decodeText2 (native decoder)', () => {
            decodeText2(byteBuffer, 0);
        });

        suite.add('decodeText3 (native + chunks)', () => {
            decodeText3(byteBuffer, 0);
        });

        suite.add('readString (native + chunks directly)', () => {
            byteBuffer.readString(0);
        });

        suite.add('readString2 (native + chunks directly)', () => {
            byteBuffer.readString2(0);
        });

        suite.add('readString3 (native + chunks directly)', () => {
            byteBufferNew2.readString3(0);
        });

        suite.add('decodeTextNew (new encoding)', () => {
            decodeTextNew(byteBufferNew, 0);
        });

        suite.add('readStringNew (new encoding directly)', () => {
            byteBufferNew.readStringNew(0);
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
