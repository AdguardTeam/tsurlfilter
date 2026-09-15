import { defineConfig } from 'vitest/config';

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
        // cross-module calls and would mask the real startup difference.
        deps: {
            optimizer: {
                ssr: {
                    enabled: true,
                    include: ['@adguard/tsurlfilter', 'tsurlfilter-v6'],
                },
            },
        },
        // No `projects` block: this package has no browser project (every engine
        // bench imports `node:fs` and `tsurlfilter-v3`), so `vitest bench --run`
        // collects the `*.bench.ts` files via `benchmark.include` directly and
        // there is no project to filter on.
        benchmark: {
            include: ['test/**/*.bench.ts'],
        },
    },
});
