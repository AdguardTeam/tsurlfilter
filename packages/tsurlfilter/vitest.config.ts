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
    },
});
