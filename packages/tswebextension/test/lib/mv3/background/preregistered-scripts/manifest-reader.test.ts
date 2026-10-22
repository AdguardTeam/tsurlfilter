import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { MANIFEST_SCHEMA_VERSION } from '../../../../../src/lib/mv3/background/preregistered-scripts/hasher';
import {
    clearManifestCache,
    readManifest,
} from '../../../../../src/lib/mv3/background/preregistered-scripts/manifest-reader';

const SCRIPTS_PATH = 'filters/preregistered-scripts';

/**
 * Serves the given body as the manifest fetch response.
 *
 * @param body Manifest JSON body to serve, or `null` to simulate a missing
 * (404) manifest.
 */
const stubManifestFetch = (body: unknown | null): void => {
    const getURL = vi.fn((p: string) => `chrome-extension://test/${p}`);
    vi.stubGlobal('chrome', { ...chrome, runtime: { ...chrome.runtime, getURL } });
    vi.stubGlobal('fetch', vi.fn(async () => {
        if (body === null) {
            return { ok: false, status: 404 };
        }
        return {
            ok: true,
            status: 200,
            json: async (): Promise<unknown> => body,
        };
    }));
};

describe('readManifest', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        clearManifestCache();
    });

    it('returns the manifest as-is when the schema version matches', async () => {
        const body = {
            schemaVersion: MANIFEST_SCHEMA_VERSION,
            hashes: ['0123456789abcdef'],
            scriptletFiles: { 'set-cookie': 's-set-cookie.js' },
        };
        stubManifestFetch(body);

        const manifest = await readManifest(SCRIPTS_PATH);

        // The manifest is the package's own build output: returned as-is,
        // without normalization.
        expect(manifest).toEqual(body);
    });

    it('throws when the manifest is unavailable (404)', async () => {
        stubManifestFetch(null);

        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('404');
    });

    it('throws on manifests written under another schema version', async () => {
        stubManifestFetch({
            schemaVersion: MANIFEST_SCHEMA_VERSION + 1,
            hashes: ['0123456789abcdef'],
            scriptletFiles: { 'set-cookie': 's-set-cookie.js' },
        });

        // A manifest with a different version is a broken build: failing
        // the sync keeps the previous registrations instead of silently
        // registering mismatched artifacts.
        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('schema version');
    });

    it('throws when the schema version is missing', async () => {
        stubManifestFetch({ hashes: [], scriptletFiles: {} });

        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('schema version');
    });

    it('throws when "hashes" is missing, so a truncated manifest does not unregister everything', async () => {
        stubManifestFetch({ schemaVersion: MANIFEST_SCHEMA_VERSION, scriptletFiles: {} });

        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('"hashes"');
    });

    it('throws when "hashes" is not an array of strings', async () => {
        stubManifestFetch({
            schemaVersion: MANIFEST_SCHEMA_VERSION,
            hashes: '0123456789abcdef',
            scriptletFiles: {},
        });

        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('"hashes"');
    });

    it('throws when "scriptletFiles" is missing or not an object', async () => {
        stubManifestFetch({ schemaVersion: MANIFEST_SCHEMA_VERSION, hashes: [] });
        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('"scriptletFiles"');

        clearManifestCache();
        stubManifestFetch({
            schemaVersion: MANIFEST_SCHEMA_VERSION,
            hashes: [],
            scriptletFiles: ['s-set-cookie.js'],
        });
        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('"scriptletFiles"');
    });

    it('throws when a scriptlet file mapping is not a string', async () => {
        stubManifestFetch({
            schemaVersion: MANIFEST_SCHEMA_VERSION,
            hashes: [],
            scriptletFiles: { 'set-cookie': 1 },
        });

        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('"set-cookie"');
    });

    it('passes an abort signal to fetch, so a hung request cannot stall the sync', async () => {
        stubManifestFetch({
            schemaVersion: MANIFEST_SCHEMA_VERSION,
            hashes: [],
            scriptletFiles: {},
        });

        await readManifest(SCRIPTS_PATH);

        const [, init] = vi.mocked(fetch).mock.calls[0];
        expect(init?.signal).toBeInstanceOf(AbortSignal);
    });

    it('rejects when the fetch is aborted', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => {
            throw new DOMException('The operation was aborted.', 'AbortError');
        }));

        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow();
    });

    it('parses the manifest once per scripts path', async () => {
        stubManifestFetch({
            schemaVersion: MANIFEST_SCHEMA_VERSION,
            hashes: [],
            scriptletFiles: {},
        });

        await readManifest(SCRIPTS_PATH);
        await readManifest(SCRIPTS_PATH);

        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    });

    it('caches a failed read until the cache is cleared', async () => {
        stubManifestFetch(null);
        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('404');

        const body = {
            schemaVersion: MANIFEST_SCHEMA_VERSION,
            hashes: [],
            scriptletFiles: {},
        };
        stubManifestFetch(body);

        // A manifest is package-immutable: refetching a broken one would
        // only stall every sync for the fetch timeout.
        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('404');
        expect(vi.mocked(fetch)).not.toHaveBeenCalled();

        clearManifestCache();

        await expect(readManifest(SCRIPTS_PATH)).resolves.toEqual(body);
    });
});
