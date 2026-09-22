import * as AGTreeV4 from 'agtree-v4';
import { test } from 'vitest';

// Vite `?raw` import — inlines the fixture as a string so this benchmark runs
// unchanged in the Node runner and the browser (Chromium/Firefox) runners.
// eslint-disable-next-line import/no-unresolved
import fixture from './fixtures/ag-base.txt?raw';

// v5 is imported from the BUILT package (`@adguard/agtree` self-reference
// resolves to `dist/` via the package `exports` map), NOT from `src/`. This is
// essential for a fair comparison: v4 ships as an optimized bundle, so v5 must
// be measured as its optimized bundle too. Running v5 straight from TypeScript
// source makes Vite transform it unoptimized on the fly and inflates its
// timings ~10x. Build the package before running this benchmark (see
// `packages/benchmarks/DEVELOPMENT.md`): inject a temporary version, then run
// `pnpm build`. The dynamic import below turns a missing/stale build into a
// clear error instead of a cryptic module-resolution failure.
const AGTREE = await import('@adguard/agtree').catch((error: unknown) => {
    throw new Error(
        'Failed to resolve the built `@adguard/agtree` bundle. '
        + 'Build it first (inject a temporary version, then `pnpm build`) — '
        + 'see packages/benchmarks/DEVELOPMENT.md.',
        { cause: error },
    );
});

const { RuleParserPipeline } = AGTREE;

// v4's `RuleParser.parse` writes raw text and source locations into the AST by
// default, while v5 does neither. Disable both so the v4 full-parse leg does
// the same work as the v5 leg and the comparison stays apples-to-apples.
const V4_PARSE_OPTIONS = { includeRaws: false, isLocIncluded: false };

// The fixture is a real AdGuard Base filter list with CRLF line endings. Split
// on `\r?\n` so no trailing `\r` is left in a rule (which would otherwise
// reject valid input); one line = one rule — the unit both v4 and v5 expose
// publicly.
const ALL_LINES = fixture.split(/\r?\n/);

// Only benchmark rules that both engines can parse without throwing, so the
// timed loops never hit the (expensive, unequal) error paths and the two
// engines are compared over an identical workload.
const LINES: string[] = [];
{
    const setupPipeline = new RuleParserPipeline();
    for (const line of ALL_LINES) {
        try {
            setupPipeline.parse(line);
            AGTreeV4.RuleParser.parse(line, V4_PARSE_OPTIONS);
            LINES.push(line);
        } catch {
            // Skip rules that either engine rejects.
        }
    }
    // Print once so a silently shrunken corpus is visible in the output.
    // eslint-disable-next-line no-console
    console.log(
        `ag-base fixture: ${ALL_LINES.length} input lines, ${LINES.length} accepted, `
        + `${ALL_LINES.length - LINES.length} rejected`,
    );
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
        // v4 full pipeline (its only public parse entry point), aligned with
        // v5 via `V4_PARSE_OPTIONS`.
        bench('v4 parse (parser + ast builder)', () => {
            for (const line of LINES) {
                resultSink += AGTreeV4.RuleParser.parse(line, V4_PARSE_OPTIONS) ? 1 : 0;
            }
        }),
    );

    if (resultSink === 0) {
        throw new Error('benchmark produced no observable results');
    }
}, 120_000);
