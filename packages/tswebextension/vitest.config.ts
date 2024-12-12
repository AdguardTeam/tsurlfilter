import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom', // Enables jsdom environment for tests.
        setupFiles: './vitest.setup.ts', // Setup file for tests.
    },
});
