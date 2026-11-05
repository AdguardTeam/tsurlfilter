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
 * A manifest every field of which is valid; tests override the field they
 * exercise.
 */
const VALID_MANIFEST = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    hashes: ['0123456789abcdef'],
    scriptletFiles: { 'set-cookie': 's-set-cookie.js' },
    hostnames: ['youtube.com', 'www.youtube.com'],
    conditions: [2],
    pageExceptions: { 2: '0123456789abcdef' },
};

/**
 * Builds a manifest body from {@link VALID_MANIFEST}: tests override only the
 * field they exercise, and pass `undefined` to drop it.
 *
 * @param overrides Fields to replace.
 *
 * @returns Manifest body to serve.
 */
const makeManifest = (overrides: Record<string, unknown> = {}): unknown => ({
    ...VALID_MANIFEST,
    ...overrides,
});

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
        stubManifestFetch(VALID_MANIFEST);

        const manifest = await readManifest(SCRIPTS_PATH);

        // The manifest is the package's own build output: returned as-is,
        // without normalization.
        expect(manifest).toEqual(VALID_MANIFEST);
    });

    it('throws when the manifest is unavailable (404)', async () => {
        stubManifestFetch(null);

        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('404');
    });

    it('keeps the conditions list', async () => {
        // The reader does not know which filters are enabled: it validates the
        // ids and leaves the selection to the runtime.
        stubManifestFetch(makeManifest({ conditions: [2, 3] }));

        const manifest = await readManifest(SCRIPTS_PATH);

        expect(manifest.conditions).toEqual([2, 3]);
    });

    it('throws when "conditions" is not a list of filter ids', async () => {
        stubManifestFetch(makeManifest({ conditions: ['../cond-2.js'] }));

        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('filter ids');
    });

    it('throws on manifests written under another schema version', async () => {
        stubManifestFetch(makeManifest({ schemaVersion: MANIFEST_SCHEMA_VERSION + 1 }));

        // A manifest with a different version is a broken build: failing
        // the sync keeps the previous registrations instead of silently
        // registering mismatched artifacts.
        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('schema version');
    });

    it('throws when the schema version is missing', async () => {
        stubManifestFetch(makeManifest({ schemaVersion: undefined }));

        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('schema version');
    });

    it('throws when "hashes" is missing, so a truncated manifest does not unregister everything', async () => {
        stubManifestFetch(makeManifest({ hashes: undefined }));

        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('"hashes"');
    });

    it('throws when "hashes" is not an array of strings', async () => {
        stubManifestFetch(makeManifest({ hashes: '0123456789abcdef' }));

        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('"hashes"');
    });

    it('throws when "scriptletFiles" is missing or not an object', async () => {
        stubManifestFetch(makeManifest({ scriptletFiles: undefined }));
        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('"scriptletFiles"');

        clearManifestCache();
        stubManifestFetch(makeManifest({ scriptletFiles: ['s-set-cookie.js'] }));
        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('"scriptletFiles"');
    });

    it('throws when a scriptlet file mapping is not a string', async () => {
        stubManifestFetch(makeManifest({ scriptletFiles: { 'set-cookie': 1 } }));

        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('"set-cookie"');
    });

    it('throws when a scriptlet file mapping is not an s-*.js basename', async () => {
        stubManifestFetch(makeManifest({ scriptletFiles: { 'set-cookie': '../s-set-cookie.js' } }));

        // The value goes straight into the MAIN-world `js` list.
        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('s-*.js');
    });

    it('throws when "hostnames" is missing, so the gate set is never guessed', async () => {
        stubManifestFetch(makeManifest({ hostnames: undefined }));

        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('"hostnames"');
    });

    it.each([
        ['an empty array', []],
        ['a bare string', 'youtube.com'],
        ['an upper-case host', ['Example.COM']],
        ['a host with a port', ['example.com:443']],
        ['a URL', ['https://example.com']],
    ])('throws when "hostnames" is %s', async (_shape, hostnames) => {
        stubManifestFetch(makeManifest({ hashes: [], hostnames }));

        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('"hostnames"');
    });

    it('throws when "pageExceptions" is missing, so a stale gate is never trusted', async () => {
        stubManifestFetch(makeManifest({ pageExceptions: undefined }));

        // Without the fingerprint the runtime cannot tell whether the baked
        // exceptions still describe the loaded filters.
        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('"pageExceptions"');
    });

    it('throws when a page-exceptions entry is not a fingerprint', async () => {
        stubManifestFetch(makeManifest({ pageExceptions: { 2: '' } }));

        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('"2"');
    });

    it('passes an abort signal to fetch, so a hung request cannot stall the sync', async () => {
        stubManifestFetch(VALID_MANIFEST);

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
        stubManifestFetch(makeManifest());

        await readManifest(SCRIPTS_PATH);
        await readManifest(SCRIPTS_PATH);

        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    });

    it('caches a failed read until the cache is cleared', async () => {
        stubManifestFetch(null);
        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('404');

        stubManifestFetch(makeManifest());

        // A manifest is package-immutable: refetching a broken one would
        // only stall every sync for the fetch timeout.
        await expect(readManifest(SCRIPTS_PATH)).rejects.toThrow('404');
        expect(vi.mocked(fetch)).not.toHaveBeenCalled();

        clearManifestCache();

        await expect(readManifest(SCRIPTS_PATH)).resolves.toEqual(makeManifest());
    });
});
