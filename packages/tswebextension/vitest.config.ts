import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true, // Enables global access to describe, it, expect, etc.
        environment: 'jsdom', // Enables jsdom environment for tests.
        setupFiles: './vitest.setup.ts', // Setup file for tests.
    },
});
