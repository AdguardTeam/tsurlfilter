import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        testTimeout: 30000,
        setupFiles: [
            './test/setup/index.ts',
            './test/setup/custom-matchers/index.ts',
        ],
        watch: false,
        // No `projects` block: this package has no browser project (every engine
        // bench imports `node:fs` and `tsurlfilter-v3`), so `vitest bench --run`
        // collects the `*.bench.ts` files via `benchmark.include` directly and
        // there is no project to filter on.
        benchmark: {
            include: ['test/**/*.bench.ts'],
        },
    },
});
