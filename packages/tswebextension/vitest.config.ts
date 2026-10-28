import { playwright } from '@vitest/browser-playwright';
import { defineConfig, defineProject, type UserWorkspaceConfig } from 'vitest/config';

import { ManifestVersionEnv } from './tasks/constants';
import { inlineCssHitsHelpers } from './tasks/inline-css-hits-helpers';
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
        // The ExtCSS benchmark lives in the MV3 test tree and is run by
        // `pnpm bench`; it must not be collected by the MV2 project. An empty
        // `include` is required: `undefined` falls back to the default
        // benchmark pattern, which ignores the `exclude` above.
        benchmark: manifestVersion === ManifestVersionEnv.Third
            ? { include: ['test/**/*.bench.ts'] }
            : { include: [] },
    },
    // The ExtCSS and CSS-hits inlining plugins are only needed for the MV3
    // project, where the `extCssInjectedApply` function (and its tests) live.
    // They are no-ops for MV2.
    plugins: manifestVersion === ManifestVersionEnv.Third
        ? [inlineExtCssBundle(), inlineCssHitsHelpers()]
        : [],
});

export default defineConfig({
    test: {
        // Setup files are configured per-project below: the jsdom projects use
        // `fake-indexeddb/auto` + `./vitest.setup.ts`, while the browser project
        // needs neither (the real browser provides native IndexedDB, and the
        // sinon-chrome `global` mock in `vitest.setup.ts` is jsdom-only).
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
                    // No benchmarks in this project; the default pattern would
                    // collect the MV3 bench, which needs the MV3-only plugins.
                    benchmark: { include: [] },
                },
            }),
            createProjectForManifestVersion(ManifestVersionEnv.Second),
            createProjectForManifestVersion(ManifestVersionEnv.Third),
            defineProject({
                test: {
                    name: 'browser',
                    include: ['test/e2e/**/*.spec.ts'],
                    // Same as the `common` project: no benchmarks here.
                    benchmark: { include: [] },
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
