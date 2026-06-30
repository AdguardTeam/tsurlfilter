/* eslint-disable no-console */
/**
 * @file Manual HITL benchmark: measures the cold-start cost of runtime
 * filter-list preparation (`FilterListParser.parse`, the dnr-converter
 * equivalent of tsurlfilter's `FilterList.prepare()`) and the end-to-end runtime
 * conversion (`FilterConverter.convert`) on a 100k+ line filter list.
 *
 * @note This is a STANDALONE, MANUALLY-RUN benchmark. It is NOT part of the test
 * suite and is NOT wired into CI. Run with `pnpm bench:cold-start [filter-path]`.
 * Requires Node.js >= 22 (global `fetch`).
 */

import { FilterListParser, type ParserOptions } from '@adguard/agtree/parser';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { Filter, FilterConverter } from '../src/index';

import { countLines, loadFilterContent, MIN_LINES } from './utils';

/**
 * Parser options replicated from `RulesScanner.PARSER_OPTIONS` so the parse
 * measurement matches the real runtime configuration.
 */
const PARSER_OPTIONS: ParserOptions = {
    tolerant: true,
    isLocIncluded: true,
    parseAbpSpecificRules: true,
    parseUboSpecificRules: true,
    includeRaws: true,
    ignoreComments: true,
    parseHostRules: false,
};

const ITERATIONS = 10;

/**
 * Measured latency statistics for a single benchmark target.
 */
interface BenchmarkMetric {
    /**
     * Human-readable target label.
     */
    label: string;
    /**
     * First-invocation latency in milliseconds — the genuine cold-start
     * (module load, JIT, first deoptimized parse) that acceptance criterion 1
     * asks for. A single sample, so treat it as an upper-bound indicator.
     */
    coldStart: number;
    /**
     * Minimum steady-state sample in milliseconds.
     */
    min: number;
    /**
     * Arithmetic mean of steady-state samples in milliseconds.
     */
    mean: number;
    /**
     * Median steady-state sample in milliseconds.
     */
    median: number;
    /**
     * 99th percentile of steady-state samples in milliseconds.
     */
    p99: number;
}

/**
 * Measures the latency of a target function. The very first invocation is
 * timed and recorded as the cold-start data point (module load, JIT, and first
 * deoptimized parse), then `iterations` more fresh runs produce steady-state
 * fresh-parse statistics. Calls `globalThis.gc` before each sample when
 * `--expose-gc` is active.
 *
 * @param label Target label for the report.
 * @param fn Target function to measure.
 * @param iterations Number of steady-state samples.
 *
 * @returns Aggregated latency statistics, including the cold-start sample.
 */
const measure = async (
    label: string,
    fn: () => void | Promise<void>,
    iterations: number,
): Promise<BenchmarkMetric> => {
    // First run = cold-start: module load, JIT, first deoptimized invocation.
    // This is the genuine first-invocation cost acceptance criterion 1 asks
    // for, so it is recorded rather than discarded.
    globalThis.gc?.();
    const coldStartStart = performance.now();
    await fn();
    const coldStart = performance.now() - coldStartStart;

    const samples: number[] = [];
    for (let i = 0; i < iterations; i += 1) {
        globalThis.gc?.();
        const start = performance.now();
        // eslint-disable-next-line no-await-in-loop
        await fn();
        samples.push(performance.now() - start);
    }

    samples.sort((a, b) => a - b);
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const median = samples[Math.floor(samples.length / 2)];
    const p99Index = Math.min(samples.length - 1, Math.floor(samples.length * 0.99));

    return {
        label,
        coldStart,
        min: samples[0],
        mean,
        median,
        p99: samples[p99Index],
    };
};

/**
 * Formats a millisecond value to a fixed string.
 *
 * @param ms Milliseconds.
 *
 * @returns Formatted string.
 */
const formatMs = (ms: number): string => ms.toFixed(2);

/**
 * Builds the markdown report content for the recorded baseline.
 *
 * @param lines Non-empty line count of the measured filter list.
 * @param sizeMb Size of the filter content in megabytes.
 * @param metrics Measured metrics.
 *
 * @returns Markdown string to write to `RESULTS.md`.
 */
const buildReport = (
    lines: number,
    sizeMb: number,
    metrics: BenchmarkMetric[],
): string => {
    const date = new Date().toISOString();
    const nodeVersion = process.version;
    const platform = `${process.platform}/${process.arch}`;

    // Build each row from a cells array joined with ' | ' (the same pattern
    // `fmtRow` uses for the console table) so every line stays under the
    // package's max-len limit (code: 120).
    const rows = metrics.map((m) => {
        const cells = [
            m.label,
            formatMs(m.coldStart),
            formatMs(m.min),
            formatMs(m.mean),
            formatMs(m.median),
            formatMs(m.p99),
        ];
        return `| ${cells.join(' | ')} |`;
    }).join('\n');

    return `# DNR Converter — Cold-Start Benchmark Results

This file is overwritten by \`pnpm bench:cold-start\` on each run. The latest
recorded baseline is below.

> Run the benchmark manually (\`pnpm bench:cold-start\`) and commit the updated
table to record a new baseline.

## Baseline

- **Date**: ${date}
- **Node.js**: ${nodeVersion}
- **Platform**: ${platform}
- **Filter lines (non-empty)**: ${lines.toLocaleString()}
- **Filter size**: ${sizeMb.toFixed(2)} MB
- **Measured iterations (per target)**: ${ITERATIONS}

| Target | cold-start (ms) | min (ms) | mean (ms) | median (ms) | p99 (ms) |
| --- | --- | --- | --- | --- | --- |
${rows}

## Notes

- \`FilterListParser.parse\` is the direct equivalent of tsurlfilter's
  \`FilterList.prepare()\` and is the runtime preparation step that moved from
  build-time to runtime.
- \`FilterConverter.convert\` (simple mode) is the end-to-end runtime conversion
  (scan + parse + convert) shown for context.
- \`cold-start (ms)\` is the timed first invocation of each target (module load,
  JIT, first deoptimized parse) — the cost acceptance criterion 1 asks for. The
  \`min\`/\`mean\`/\`median\`/\`p99\` columns are steady-state fresh-parse
  statistics over ${ITERATIONS} repeat runs.
- A human reviewer decides whether the recorded latency is acceptable; there is
  no hard threshold and no CI gate.
`;
};

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Main entry point: loads the filter, runs both measurements, prints a table,
 * and writes the report to `benchmarks/RESULTS.md`.
 */
const main = async (): Promise<void> => {
    const filePath = process.argv[2];

    console.log('Loading filter list...');
    const content = await loadFilterContent(filePath);

    const lines = countLines(content);
    const sizeMb = Buffer.byteLength(content) / 1024 / 1024;

    console.log(`Filter lines (non-empty): ${lines.toLocaleString()}`);
    console.log(`Filter size: ${sizeMb.toFixed(2)} MB`);

    if (lines < MIN_LINES) {
        console.warn(
            `WARNING: filter has ${lines} non-empty lines, which is below the`
            + ` ${MIN_LINES} target. Results may not be representative.`,
        );
    }

    console.log(`\nMeasuring (cold-start + ${ITERATIONS} steady-state iterations per target)...\n`);

    const parseMetric = await measure(
        'FilterListParser.parse (FilterList.prepare equivalent)',
        () => {
            FilterListParser.parse(content, PARSER_OPTIONS);
        },
        ITERATIONS,
    );

    const converter = new FilterConverter();
    const convertMetric = await measure(
        'FilterConverter.convert (end-to-end runtime)',
        async () => {
            await converter.convert([new Filter(0, content)]);
        },
        ITERATIONS,
    );

    const metrics = [parseMetric, convertMetric];

    // Print a console table (cold-start is the timed first invocation).
    const headers = ['Target', 'cold-start', 'min', 'mean', 'median', 'p99'];
    const fmtRow = (cells: (string | number)[]): string => cells
        .map((c, i) => (i === 0 ? String(c).padEnd(46) : String(c).padStart(10)))
        .join(' | ');

    const headerRow = fmtRow(headers);
    console.log('Results (ms):');
    console.log(`  ${headerRow}`);
    console.log(`  ${'-'.repeat(headerRow.length)}`);
    for (const m of metrics) {
        const row = fmtRow([
            m.label,
            formatMs(m.coldStart),
            formatMs(m.min),
            formatMs(m.mean),
            formatMs(m.median),
            formatMs(m.p99),
        ]);
        console.log(`  ${row}`);
    }

    // Write the report.
    const reportPath = path.join(__dirname, 'RESULTS.md');
    await writeFile(reportPath, buildReport(lines, sizeMb, metrics), 'utf-8');
    console.log(`\nReport written to ${reportPath}`);
};

main().catch((error) => {
    console.error('Benchmark failed:', error);
    throw error;
});
