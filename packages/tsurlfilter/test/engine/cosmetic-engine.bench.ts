/* eslint-disable max-len */
import { readFileSync } from 'node:fs';

import * as TsUrlFilterOld from 'tsurlfilter-v3';
import { test } from 'vitest';

import { type IndexedStorageCosmeticRuleParts } from '@adguard/tsurlfilter';
import { ScannerType } from '@adguard/tsurlfilter/es/scanner-type';

import { ENGINE_BENCH_OPTIONS } from './engine-bench-options';

// `current` is imported from the BUILT `@adguard/tsurlfilter` package
// (its `exports` map resolves to `dist/`), NOT from `src/`. Vite serves
// `src/` module-by-module and deoptimizes cross-module calls, which
// inflates the current leg 1.7–11×; the published baselines are optimized
// bundles, so the current code must be measured as its bundle too. Build
// the package before running this benchmark (see
// `packages/benchmarks/DEVELOPMENT.md`). The dynamic import turns a
// missing/stale build into a clear error instead of a cryptic
// module-resolution failure.
const TSURLFILTER = await import('@adguard/tsurlfilter').catch((error: unknown) => {
    throw new Error(
        'Failed to resolve the built `@adguard/tsurlfilter` bundle. '
        + 'Build it first (inject a temporary version, then `pnpm build`) — '
        + 'see packages/benchmarks/DEVELOPMENT.md.',
        { cause: error },
    );
});

const { CosmeticEngine, RuleStorage, StringRuleList } = TSURLFILTER;

// Keep the timed work observable: each bench accumulates a cheap checksum here
// so the engine can't eliminate the closure, and we guard it after the run.
let resultSink = 0;

test('build cosmetic engine: current vs v3', async ({ bench }) => {
    const rawFilter = readFileSync('test/resources/adguard_base_filter.txt', 'utf-8');
    const preprocessedFilter = TsUrlFilterOld.FilterListPreprocessor.preprocess(rawFilter);

    const createOldEngine = () => {
        const list = new TsUrlFilterOld.BufferRuleList(
            2,
            preprocessedFilter.filterList,
            false,
            false,
            false,
            preprocessedFilter.sourceMap,
        );
        const storage = new TsUrlFilterOld.RuleStorage([list]);
        const engine = new TsUrlFilterOld.CosmeticEngine(storage, false);
        return engine;
    };

    const createNewEngine = () => {
        const list = new StringRuleList(
            2,
            rawFilter,
            false,
            false,
            false,
        );
        const storage = new RuleStorage([list]);
        // Scan inline instead of using the shared test helper: the helper is
        // typed against `src/`, while the classes above come from the built
        // bundle, and mixing the two declaration sets does not type-check.
        const scanner = storage.createRuleStorageScanner(ScannerType.CosmeticRules);
        const rulesParts: IndexedStorageCosmeticRuleParts[] = [];
        while (scanner.scan()) {
            rulesParts.push(scanner.getRuleParts()! as IndexedStorageCosmeticRuleParts);
        }

        const engine = CosmeticEngine.createSync(rulesParts, storage);
        return engine;
    };

    await bench.compare(
        bench('v3 cosmetic engine', () => {
            resultSink += createOldEngine().rulesCount;
        }),
        bench('current cosmetic engine', () => {
            resultSink += createNewEngine().rulesCount;
        }),
        ENGINE_BENCH_OPTIONS,
    );

    if (resultSink === 0) {
        throw new Error('benchmark produced no observable results');
    }
});
