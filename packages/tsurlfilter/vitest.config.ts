import { defineConfig } from 'vitest/config';

// Pre-bundling the compared bundles with esbuild changes how the module runner
// serves the in-project `dist`, so the benchmark-only optimizer must not leak
// into the regular unit-test path.
const isBench = process.argv.includes('bench');

export default defineConfig({
    test: {
        // FIXME
        testTimeout: 40000,
        setupFiles: [
            './test/setup/index.ts',
            './test/setup/custom-matchers/index.ts',
        ],
        watch: false,
        // `engine-init.bench.ts` compares the built `@adguard/tsurlfilter`
        // bundle against the published `tsurlfilter-v6`. Pre-bundle both (and
        // their transitive `@adguard/*` deps) with esbuild so the in-project
        // current build is not served module-by-module — which deoptimizes
        // cross-module calls and would mask the real startup difference. This
        // is benchmark-only setup, so it is enabled just for `vitest bench`.
        deps: isBench
            ? {
                optimizer: {
                    ssr: {
                        enabled: true,
                        include: ['@adguard/tsurlfilter', 'tsurlfilter-v6'],
                    },
                },
            }
            : undefined,
        // No `projects` block: this package has no browser project (the engine
        // benches read fixtures via `node:fs`), so `vitest bench --run`
        // collects the `*.bench.ts` files via `benchmark.include` directly and
        // there is no project to filter on.
        benchmark: {
            include: ['test/**/*.bench.ts'],
        },
    },
});
