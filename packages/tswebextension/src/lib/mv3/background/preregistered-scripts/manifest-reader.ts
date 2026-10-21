import { MANIFEST_FILENAME, MANIFEST_SCHEMA_VERSION, type PreregisteredScriptsManifest } from './hasher';

/**
 * Timeout for fetching the build-time manifest. It is a local package file,
 * so a hanging request means the worker is stuck, not slow.
 */
const MANIFEST_FETCH_TIMEOUT_MS = 5000;

/**
 * Parsed manifests per scripts path. Artifacts are immutable for the
 * lifetime of an extension version, so a service worker can reuse the
 * parsed manifest across syncs instead of refetching it.
 */
const manifestCache = new Map<string, PreregisteredScriptsManifest>();

/**
 * Clears the parsed manifest cache. Intended for tests.
 */
export const clearManifestCache = (): void => {
    manifestCache.clear();
};

/**
 * Fetches the build-time manifest shipped next to the artifacts. It lists
 * the rule hashes with matching generated files and the scriptlet name →
 * function-file map.
 *
 * The manifest is this package's own build output, so its shape is trusted
 * rather than validated: a missing, unreadable, or version-mismatched
 * manifest is a broken build, and failing the sync keeps the previous
 * registrations instead of silently dropping them.
 *
 * @param scriptsPath Extension-relative path to the preregistered scripts
 * directory.
 *
 * @returns Parsed manifest.
 *
 * @throws If the manifest cannot be fetched, the fetch times out, or the
 * manifest has an unexpected schema version.
 */
export const readManifest = async (scriptsPath: string): Promise<PreregisteredScriptsManifest> => {
    const cached = manifestCache.get(scriptsPath);
    if (cached) {
        return cached;
    }

    const url = chrome.runtime.getURL(`${scriptsPath}/${MANIFEST_FILENAME}`);
    const response = await fetch(url, { signal: AbortSignal.timeout(MANIFEST_FETCH_TIMEOUT_MS) });

    if (!response.ok) {
        throw new Error(`Failed to fetch the manifest at ${url} (status ${response.status})`);
    }

    const manifest: PreregisteredScriptsManifest = await response.json();

    if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
        throw new Error(`Unsupported manifest schema version ${manifest.schemaVersion} at ${url}`);
    }

    manifestCache.set(scriptsPath, manifest);

    return manifest;
};
