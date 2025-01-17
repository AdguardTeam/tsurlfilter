import { defineConfig } from 'vitest/config';

import { MANIFEST_ENV, ManifestVersionEnv } from './tasks/constants';

export default defineConfig({
    test: {
        environment: 'jsdom', // Enables jsdom environment for tests.
        setupFiles: './vitest.setup.ts', // Setup file for tests.
        exclude: [
            // node_modules are excluded by default and when we extend
            // the default config, we need to exclude them explicitly.
            '**/node_modules/**',
            MANIFEST_ENV === ManifestVersionEnv.Second
                ? '**/test/lib/mv3/**'
                : '**/test/lib/mv2/**',
        ],
    },
});
