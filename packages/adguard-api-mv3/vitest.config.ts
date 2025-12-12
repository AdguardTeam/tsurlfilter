// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        watch: false,
        // Use jsdom environment to provide browser globals like 'self', 'window', etc.
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
    },
});
