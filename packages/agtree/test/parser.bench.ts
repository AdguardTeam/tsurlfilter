import * as AGTreeV2 from 'agtree-v2';
import { test } from 'vitest';

// v5 is imported from the BUILT package (`@adguard/agtree` self-reference
// resolves to `dist/` via the package `exports` map), NOT from `src/`. Vite
// serves `src/` module-by-module and deoptimizes cross-module calls, which
// inflates the v5 leg 1.7–11×; the v2 baseline is an optimized published
// bundle, so v5 must be measured as its bundle too. Build the package before
// running this benchmark (see `packages/benchmarks/DEVELOPMENT.md`). The
// dynamic import turns a missing/stale build into a clear error instead of a
// cryptic module-resolution failure.
const AGTREE = await import('@adguard/agtree').catch((error: unknown) => {
    throw new Error(
        'Failed to resolve the built `@adguard/agtree` bundle. '
        + 'Build it first (inject a temporary version, then `pnpm build`) — '
        + 'see packages/benchmarks/DEVELOPMENT.md.',
        { cause: error },
    );
});

const { RuleParserPipeline } = AGTREE;

const RULES = [
    '! Title: Example',
    '||example.org^$third-party',
    '@@||example.net^$document',
    'example.com##.banner',
    'example.com#?#div:has(> .ad)',
    'example.com#%#//scriptlet(\'set-constant\', \'a\', \'true\')',
    'example.com#$#.ad { display: none; }',
    '||example.org^$removeparam=utm_source',
];

// Keep the timed work observable: each bench accumulates a cheap checksum here
// so the engine can't eliminate the closure, and we guard it after the run.
let resultSink = 0;

test('AGTree parse: current vs v2', async ({ bench }) => {
    const parser = new RuleParserPipeline();
    await bench.compare(
        bench('current parse', () => {
            for (const rule of RULES) {
                resultSink += parser.parse(rule) ? 1 : 0;
            }
        }),
        bench('v2 parse', () => {
            for (const rule of RULES) {
                resultSink += AGTreeV2.RuleParser.parse(rule) ? 1 : 0;
            }
        }),
    );

    if (resultSink === 0) {
        throw new Error('benchmark produced no observable results');
    }
});
