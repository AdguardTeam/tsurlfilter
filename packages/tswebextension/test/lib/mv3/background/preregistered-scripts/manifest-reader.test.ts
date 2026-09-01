import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { MANIFEST_SCHEMA_VERSION } from '../../../../../src/lib/mv3/background/preregistered-scripts/hasher';
import { readManifest } from '../../../../../src/lib/mv3/background/preregistered-scripts/manifest-reader';

const SCRIPTS_PATH = 'filters/preregistered-scripts';

/**
 * Serves the given body as the manifest fetch response.
 *
 * @param body Manifest JSON body to serve.
 */
const stubManifestFetch = (body: unknown): void => {
    const getURL = vi.fn((p: string) => `chrome-extension://test/${p}`);
    vi.stubGlobal('chrome', { ...chrome, runtime: { ...chrome.runtime, getURL } });
    vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => body,
    })));
};

describe('readManifest', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('drops non-string scriptletFiles entries', async () => {
        stubManifestFetch({ hashes: [], scriptletFiles: { good: 's-a.js', bad: 123 } });

        const manifest = await readManifest(SCRIPTS_PATH);

        expect(manifest?.scriptletFiles).toEqual({ good: 's-a.js' });
    });

    it('never resolves inherited keys for missing scriptlet names', async () => {
        stubManifestFetch({ hashes: [] });

        const manifest = await readManifest(SCRIPTS_PATH);

        // A scriptlet named `constructor` must not resolve the inherited
        // Object.prototype.constructor.
        expect(manifest?.scriptletFiles.constructor).toBeUndefined();
    });

    it('rejects manifests written under a newer schema version', async () => {
        stubManifestFetch({
            schemaVersion: MANIFEST_SCHEMA_VERSION + 1,
            hashes: ['0123456789abcdef'],
            scriptletFiles: { 'set-cookie': 's-set-cookie.js' },
        });

        const manifest = await readManifest(SCRIPTS_PATH);

        // A future generation's manifest fields may have changed meaning —
        // refusing it degrades to dynamic injection instead of silently
        // registering mismatched artifacts.
        expect(manifest).toBeNull();
    });
});
