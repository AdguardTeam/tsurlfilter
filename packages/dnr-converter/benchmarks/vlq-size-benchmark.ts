/* eslint-disable no-console */
/**
 * @file Manual HITL benchmark: compares the serialized size of the source map
 * in its current compact JSON format (array of `[declarativeRuleId,
 * sourceRuleIndex, filterId]` integer triples) versus a base64 VLQ encoding, on
 * a representative 100k+ line ruleset.
 *
 * @note This is a STANDALONE, MANUALLY-RUN benchmark. It is NOT part of the
 * test suite and is NOT wired into CI. Run with `pnpm bench:vlq [filter-path]`.
 * Requires Node.js >= 22 (global `fetch`) and a built `@adguard/agtree`.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Filter } from '../src/index';
import { RulesConverter } from '../src/rule-converters';
import { RulesScanner } from '../src/rules-scanner';
import { SourceMap } from '../src/ruleset/source-map';

import { countLines, loadFilterContent, MIN_LINES } from './utils';

/**
 * Base64 alphabet used by the standard source-map VLQ encoding.
 */
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Number of data bits carried by a single VLQ base64 digit.
 */
const VLQ_BASE_SHIFT = 5;

/**
 * Continuation bit: set on a VLQ digit when more digits follow.
 */
const VLQ_CONTINUATION_BIT = 1 << VLQ_BASE_SHIFT;

/**
 * Encodes a single non-negative integer as a base64 VLQ string (standard
 * source-map VLQ). A sign bit is used (bit 0 of the first decoded value), but
 * all source-map values are non-negative, so the sign bit is always 0.
 *
 * Arithmetic (not bitwise) is used for the magnitude to support values up to
 * 2^31-1 (declarative rule IDs are text hashes) without 32-bit overflow.
 *
 * @param value Non-negative integer to encode.
 *
 * @returns Base64 VLQ string for the value.
 */
const encodeVlq = (value: number): string => {
    let result = '';
    // source-map VLQ sign convention: bit 0 = sign, remaining bits = magnitude.
    // Use arithmetic to avoid 32-bit overflow for values >= 2^30.
    let vlq = value < 0 ? ((-value) * 2) + 1 : value * 2;
    do {
        let digit = vlq % 32;
        vlq = Math.floor(vlq / 32);
        if (vlq > 0) {
            digit |= VLQ_CONTINUATION_BIT;
        }
        result += BASE64_CHARS[digit];
    } while (vlq > 0);
    return result;
};

/**
 * Encodes an array of `[declarativeRuleId, sourceRuleIndex, filterId]` triples
 * as a base64 VLQ string. Each triple is one comma-separated segment (mirroring
 * the source-map "mappings" format); values within a segment are concatenated
 * without a separator because VLQ is self-delimiting.
 *
 * @param triples Array of integer triples to encode.
 *
 * @returns VLQ-encoded string.
 */
const encodeSourceMapVlq = (triples: number[][]): string => triples
    .map(([id, index, filterId]) => encodeVlq(id) + encodeVlq(index) + encodeVlq(filterId))
    .join(',');

/**
 * Measured size comparison for the source map.
 */
interface VlqBenchmarkMetric {
    /**
     * Number of source-map triples measured.
     */
    triples: number;
    /**
     * Serialized size of the current JSON format, in bytes.
     */
    currentBytes: number;
    /**
     * Serialized size of the base64 VLQ format, in bytes.
     */
    vlqBytes: number;
    /**
     * Absolute savings (currentBytes - vlqBytes), in bytes.
     */
    savedBytes: number;
    /**
     * Size reduction as a percentage of the current format.
     */
    savingsPct: number;
}

/**
 * Builds the markdown report content for the recorded baseline.
 *
 * @param lines Non-empty line count of the measured filter list.
 * @param sizeMb Size of the filter content in megabytes.
 * @param metric Measured size comparison.
 *
 * @returns Markdown string to write to `vlq-results.md`.
 */
const buildReport = (
    lines: number,
    sizeMb: number,
    metric: VlqBenchmarkMetric,
): string => {
    const date = new Date().toISOString();
    const nodeVersion = process.version;
    const platform = `${process.platform}/${process.arch}`;
    const currentLoc = metric.currentBytes.toLocaleString();
    const currentKb = (metric.currentBytes / 1024).toFixed(2);
    const vlqLoc = metric.vlqBytes.toLocaleString();
    const vlqKb = (metric.vlqBytes / 1024).toFixed(2);
    const savedLoc = metric.savedBytes.toLocaleString();
    const savedKb = (metric.savedBytes / 1024).toFixed(2);

    return `# DNR Converter — VLQ Source-Map Size Benchmark Results

This file is overwritten by \`pnpm bench:vlq\` on each run. The latest recorded
baseline is below.

> Run the benchmark manually (\`pnpm bench:vlq\`) and commit the updated table
to record a new baseline.

## Baseline

- **Date**: ${date}
- **Node.js**: ${nodeVersion}
- **Platform**: ${platform}
- **Filter lines (non-empty)**: ${lines.toLocaleString()}
- **Filter size**: ${sizeMb.toFixed(2)} MB
- **Source-map triples**: ${metric.triples.toLocaleString()}

| Format | Size (bytes) | Size (KB) |
| --- | --- | --- |
| Current JSON (array of triples) | ${currentLoc} | ${currentKb} |
| Base64 VLQ | ${vlqLoc} | ${vlqKb} |

- **Absolute savings**: ${savedLoc} bytes (${savedKb} KB)
- **Reduction**: ${metric.savingsPct.toFixed(2)}%

## Notes

- The current format is \`JSON.stringify\` of \`[[declarativeRuleId,
  sourceRuleIndex, filterId], ...]\` (field names removed to reduce size).
- VLQ encodes each triple as one comma-separated base64 VLQ segment
  (\`encodeVlq(id) + encodeVlq(index) + encodeVlq(filterId)\`), mirroring the
  source-map "mappings" format.
- A human reviewer decides whether the savings justify adopting VLQ (custom
  codec, reduced debuggability, schema change) versus dropping it with a
  documented note. There is no CI gate.
`;
};

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Main entry point: loads the filter, scans + converts it to obtain a real
 * source map, compares current JSON size vs base64 VLQ size, prints a table,
 * and writes the report to `benchmarks/vlq-results.md`.
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

    console.log('\nScanning and converting to build a real source map...');

    const { filters: scannedFilters } = await RulesScanner.scanFilters(
        [new Filter(0, content)],
        undefined,
        undefined,
    );
    const converted = await RulesConverter.convert(scannedFilters);
    const sources = converted.sourceMapValues;

    const triples = sources.map((s) => [
        s.declarativeRuleId,
        s.sourceRuleIndex,
        s.filterId,
    ]);

    const currentJson = new SourceMap(sources).serialize();
    const vlq = encodeSourceMapVlq(triples);

    const currentBytes = Buffer.byteLength(currentJson);
    const vlqBytes = Buffer.byteLength(vlq);
    const savedBytes = currentBytes - vlqBytes;
    const savingsPct = currentBytes > 0 ? (1 - vlqBytes / currentBytes) * 100 : 0;

    const metric: VlqBenchmarkMetric = {
        triples: triples.length,
        currentBytes,
        vlqBytes,
        savedBytes,
        savingsPct,
    };

    console.log('\nResults:');
    console.log(`  Source-map triples : ${metric.triples.toLocaleString()}`);
    console.log(`  Current JSON bytes : ${currentBytes.toLocaleString()} (${(currentBytes / 1024).toFixed(2)} KB)`);
    console.log(`  VLQ bytes          : ${vlqBytes.toLocaleString()} (${(vlqBytes / 1024).toFixed(2)} KB)`);
    console.log(`  Saved bytes        : ${savedBytes.toLocaleString()} (${(savedBytes / 1024).toFixed(2)} KB)`);
    console.log(`  Reduction          : ${savingsPct.toFixed(2)}%`);

    const report = buildReport(lines, sizeMb, metric);
    const reportPath = path.resolve(__dirname, 'vlq-results.md');
    await writeFile(reportPath, report, 'utf-8');
    console.log(`\nReport written to ${path.relative(process.cwd(), reportPath)}`);
};

main().catch((error) => {
    console.error('Benchmark failed:', error);
    throw error;
});
