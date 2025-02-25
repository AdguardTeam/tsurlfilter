import { defineWorkspace, type WorkspaceProjectConfiguration } from 'vitest/config';

import { ManifestVersionEnv } from './tasks/constants';

/**
 * Creates a test configuration for a specific manifest version.
 *
 * @param manifestVersion The manifest version to create the test for.
 *
 * @returns The test configuration.
 */
const createWorkspaceConfigForManifestVersion = (
    manifestVersion: ManifestVersionEnv,
): WorkspaceProjectConfiguration => ({
    test: {
        name: `mv${manifestVersion}`,
        env: {
            MANIFEST_ENV: manifestVersion,
        },
        environment: 'jsdom',
        setupFiles: [
            'fake-indexeddb/auto',
            './vitest.setup.ts',
        ],
        environmentOptions: {},
        exclude: [
            // node_modules are excluded by default and when we extend
            // the default config, we need to exclude them explicitly.
            '**/node_modules/**',
            // eslint-disable-next-line max-len
            `**/test/lib/mv${manifestVersion === ManifestVersionEnv.Second ? ManifestVersionEnv.Third : ManifestVersionEnv.Second}/**`,
            '**/test/lib/common/**',
        ],
    },
});

export default defineWorkspace([
    {
        test: {
            name: 'common',
            environment: 'jsdom',
            setupFiles: [
                'fake-indexeddb/auto',
                './vitest.setup.ts',
            ],
            environmentOptions: {},
            exclude: [
                // node_modules are excluded by default and when we extend
                // the default config, we need to exclude them explicitly.
                '**/node_modules/**',
                '**/test/lib/mv*/**',
            ],
        },
    },
    createWorkspaceConfigForManifestVersion(ManifestVersionEnv.Second),
    createWorkspaceConfigForManifestVersion(ManifestVersionEnv.Third),
]);
