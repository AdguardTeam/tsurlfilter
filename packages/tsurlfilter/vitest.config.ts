import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        testTimeout: 30000,
        setupFiles: [
            './test/setup/index.ts',
            './test/setup/custom-matchers/index.ts',
        ],
        watch: false,
    },
});
