import * as AGTreeV4 from 'agtree-v4';
import { test } from 'vitest';

// v5 is imported from the BUILT package (`@adguard/agtree` self-reference
// resolves to `dist/` via the package `exports` map), NOT from `src/`. This is
// essential for a fair comparison: v4 ships as an optimized bundle, so v5 must
// be measured as its optimized bundle too. Running v5 straight from TypeScript
// source makes Vite transform it unoptimized on the fly and inflates its
// timings ~10x. Build the package before running this benchmark: `pnpm build`.
import { RawFilterListConverter, RawRuleConverter } from '@adguard/agtree';

// Vite `?raw` import — inlines the fixture as a string so the benchmark needs
// no `node:fs` read.
// eslint-disable-next-line import/no-unresolved
import fixture from './fixtures/ubo-filters.txt?raw';

// The fixture is a real uBlock Origin filter list: one rule per line, ~10.9k
// rules. A uBO list exercises the converter far harder than an already-AdGuard
// list, where the vast majority of rules would be copied verbatim.
const ALL_LINES = fixture.split('\n');

/**
 * Selects the rules both engines convert without throwing.
 *
 * Only such rules are benchmarked per rule, so the timed loops never hit the
 * (expensive, unequal) error paths and both engines run an identical workload.
 * UBO scriptlet calls with a trailing backslash before `)` are rejected by v5
 * (8 rules of this fixture); the list-level benches below still cover them,
 * because there they are tolerated (kept verbatim) instead of throwing.
 *
 * @param lines Candidate rules.
 *
 * @returns Rules that both engines convert.
 */
function selectCommonLines(lines: string[]): string[] {
    const selected: string[] = [];
    for (const line of lines) {
        try {
            RawRuleConverter.convertToAdg(line);
            AGTreeV4.RawRuleConverter.convertToAdg(line);
            selected.push(line);
        } catch {
            // Skip rules that either engine rejects.
        }
    }
    return selected;
}

const LINES = selectCommonLines(ALL_LINES);

// Sanity checks, run once before timing.
//
// The converted TEXT is deliberately not compared: v5 re-serializes cosmetic
// CSS declarations (`margin-top:0` -> `margin-top: 0`, no trailing `;`) while
// v4 keeps the source formatting, so the outputs legitimately differ. What must
// match is the structure of the converted list — same number of lines — and the
// workload must actually convert rules, not merely copy them.
const V5_LIST_RESULT = RawFilterListConverter.convertToAdg(fixture);
const V4_LIST_RESULT = AGTreeV4.RawFilterListConverter.convertToAdg(fixture);
{
    const v5Lines = V5_LIST_RESULT.converted.split('\n').length;
    const v4Lines = V4_LIST_RESULT.result.split('\n').length;
    if (v5Lines !== v4Lines) {
        throw new Error(`converted line count mismatch: v5 ${v5Lines}, v4 ${v4Lines}`);
    }
    if (V5_LIST_RESULT.sourceMap.originals.length === 0) {
        throw new Error('fixture produced no conversions, the benchmark would measure copying only');
    }
}

// Keep the timed work observable: each bench accumulates a cheap checksum here
// so the engine can't eliminate the closure, and we guard it after the run.
let resultSink = 0;

test('AGTree convert ubo-filters fixture: v5 vs v4', async ({ bench }) => {
    await bench.compare(
        // Whole-list conversion, v5: one call walks the list, parses each line
        // structurally, builds an AST only for conversion candidates, and also
        // produces the reverse source map and the non-fatal error list.
        bench('v5 list convertToAdg', () => {
            resultSink += RawFilterListConverter.convertToAdg(fixture).converted.length;
        }),
        // Whole-list conversion, v4: the same workload, but v4 produces neither
        // a source map nor an error list, so treat its timing as a lower bound
        // for the old design rather than a like-for-like feature comparison.
        bench('v4 list convertToAdg', () => {
            resultSink += AGTreeV4.RawFilterListConverter.convertToAdg(fixture).result.length;
        }),
        // Per-rule conversion of the same lines, one rule at a time — the
        // granularity the old tsurlfilter `FilterList` conversion loop used.
        bench('v5 rule convertToAdg', () => {
            for (const line of LINES) {
                resultSink += RawRuleConverter.convertToAdg(line).result.length;
            }
        }),
        bench('v4 rule convertToAdg', () => {
            for (const line of LINES) {
                resultSink += AGTreeV4.RawRuleConverter.convertToAdg(line).result.length;
            }
        }),
    );

    if (resultSink === 0) {
        throw new Error('benchmark produced no observable results');
    }
}, 120_000);
