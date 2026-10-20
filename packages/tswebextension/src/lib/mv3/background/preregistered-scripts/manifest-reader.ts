import { MANIFEST_FILENAME, MANIFEST_SCHEMA_VERSION, type PreregisteredScriptsManifest } from './hasher';

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
 * @throws If the manifest cannot be fetched or has an unexpected schema
 * version.
 */
export const readManifest = async (scriptsPath: string): Promise<PreregisteredScriptsManifest> => {
    const url = chrome.runtime.getURL(`${scriptsPath}/${MANIFEST_FILENAME}`);
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch the manifest at ${url} (status ${response.status})`);
    }

    const manifest: PreregisteredScriptsManifest = await response.json();

    if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
        throw new Error(`Unsupported manifest schema version ${manifest.schemaVersion} at ${url}`);
    }

    return manifest;
};
