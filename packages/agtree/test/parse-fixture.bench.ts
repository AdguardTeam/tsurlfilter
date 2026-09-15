import * as AGTreeV4 from 'agtree-v4';
import { test } from 'vitest';

// v5 is imported from the BUILT package (`@adguard/agtree` self-reference
// resolves to `dist/` via the package `exports` map), NOT from `src/`. This is
// essential for a fair comparison: v4 ships as an optimized bundle, so v5 must
// be measured as its optimized bundle too. Running v5 straight from TypeScript
// source makes Vite transform it unoptimized on the fly and inflates its
// timings ~10x. Build the package before running this benchmark: `pnpm build`.
import { RuleParserPipeline } from '@adguard/agtree';

// Vite `?raw` import — inlines the fixture as a string so this benchmark runs
// unchanged in the Node runner and the browser (Chromium/Firefox) runners.
// eslint-disable-next-line import/no-unresolved
import fixture from './fixtures/ag-base.txt?raw';

// The fixture is a real AdGuard Base filter list; parsing is performed per rule
// (one line = one rule), which is the unit both v4 and v5 expose publicly.
const ALL_LINES = fixture.split('\n');

// Only benchmark rules that both engines can parse without throwing, so the
// timed loops never hit the (expensive, unequal) error paths and the two
// engines are compared over an identical workload.
const LINES: string[] = [];
{
    const setupPipeline = new RuleParserPipeline();
    for (const line of ALL_LINES) {
        try {
            setupPipeline.parse(line);
            AGTreeV4.RuleParser.parse(line);
            LINES.push(line);
        } catch {
            // Skip rules that either engine rejects.
        }
    }
}

// Keep the timed work observable: each bench accumulates a cheap checksum here
// so the engine can't eliminate the closure, and we guard it after the run.
let resultSink = 0;

test('AGTree parse ag-base fixture: v5 vs v4', async ({ bench }) => {
    const pipeline = new RuleParserPipeline();

    await bench.compare(
        // v5 full pipeline: tokenize + structural parse + AST builder.
        bench('v5 parse (parser + ast builder)', () => {
            for (const line of LINES) {
                resultSink += pipeline.parse(line) ? 1 : 0;
            }
        }),
        // v5 structural stage only: tokenize + structural parse, no AST built.
        bench('v5 parseStructural (parser only)', () => {
            for (const line of LINES) {
                resultSink += pipeline.parseStructural(line).kind;
            }
        }),
        // v4 full pipeline (its only public parse entry point).
        bench('v4 parse (parser + ast builder)', () => {
            for (const line of LINES) {
                resultSink += AGTreeV4.RuleParser.parse(line) ? 1 : 0;
            }
        }),
    );

    if (resultSink === 0) {
        throw new Error('benchmark produced no observable results');
    }
}, 120_000);
