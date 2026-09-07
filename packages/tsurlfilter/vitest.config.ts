import { defineConfig, defineProject } from 'vitest/config';

export default defineConfig({
    test: {
        testTimeout: 30000,
        setupFiles: [
            './test/setup/index.ts',
            './test/setup/custom-matchers/index.ts',
        ],
        watch: false,
        benchmark: {
            include: ['test/**/*.bench.ts'],
        },
        // The `bench` script runs `vitest bench --run --project "node*"`; in
        // bench mode Vitest renames this project to "node (bench)", so the
        // wildcard keeps the script independent of that internal suffix.
        // There is no browser project here: every engine bench imports `node:fs`
        // and `tsurlfilter-v3`, so none of them can run in Chromium.
        projects: [
            defineProject({
                test: {
                    name: 'node',
                },
            }),
        ],
    },
});
