import { playwright } from '@vitest/browser-playwright';
import { defineConfig, defineProject, type UserWorkspaceConfig } from 'vitest/config';

import { ManifestVersionEnv } from './tasks/constants';
import { inlineExtCssBundle } from './tasks/inline-extcss-bundle';

/**
 * Creates a test configuration for a specific manifest version.
 *
 * @param manifestVersion The manifest version to create the test for.
 *
 * @returns The test configuration.
 */
const createProjectForManifestVersion = (
    manifestVersion: ManifestVersionEnv,
): UserWorkspaceConfig => defineProject({
    test: {
        name: `mv${manifestVersion}`,
        env: {
            MANIFEST_ENV: manifestVersion,
        },
        setupFiles: [
            'fake-indexeddb/auto',
            './vitest.setup.ts',
        ],
        environment: 'jsdom',
        environmentOptions: {},
        exclude: [
            // node_modules are excluded by default and when we extend
            // the default config, we need to exclude them explicitly.
            '**/node_modules/**',
            // eslint-disable-next-line max-len
            `**/test/lib/mv${manifestVersion === ManifestVersionEnv.Second ? ManifestVersionEnv.Third : ManifestVersionEnv.Second}/**`,
            '**/test/lib/common/**',
            // Browser e2e specs are run via `pnpm test:e2e` (vitest --project browser).
            '**/test/e2e/**',
        ],
    },
    // The ExtCSS inlining plugin is only needed for the MV3 project, where the
    // `applyExtCss` function (and its tests) live. It is a no-op for MV2.
    plugins: manifestVersion === ManifestVersionEnv.Third
        ? [inlineExtCssBundle()]
        : [],
});

export default defineConfig({
    test: {
        setupFiles: [
            'fake-indexeddb/auto',
            './vitest.setup.ts',
        ],
        environment: 'jsdom',
        environmentOptions: {},
        projects: [
            defineProject({
                test: {
                    name: 'common',
                    setupFiles: [
                        'fake-indexeddb/auto',
                        './vitest.setup.ts',
                    ],
                    environment: 'jsdom',
                    environmentOptions: {},
                    exclude: [
                        // node_modules are excluded by default and when we extend
                        // the default config, we need to exclude them explicitly.
                        '**/node_modules/**',
                        '**/test/lib/mv*/**',
                        // Browser e2e specs are run via `pnpm test:e2e` (vitest --project browser).
                        '**/test/e2e/**',
                    ],
                },
            }),
            createProjectForManifestVersion(ManifestVersionEnv.Second),
            createProjectForManifestVersion(ManifestVersionEnv.Third),
            defineProject({
                test: {
                    name: 'browser',
                    include: ['test/e2e/**/*.spec.ts'],
                    browser: {
                        enabled: true,
                        provider: playwright(),
                        headless: true,
                        instances: [
                            { browser: 'chromium' },
                        ],
                    },
                },
            }),
        ],
    },
});
