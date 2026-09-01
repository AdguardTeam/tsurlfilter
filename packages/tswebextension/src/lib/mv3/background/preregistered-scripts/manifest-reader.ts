import { logger } from '../../../common/utils/logger';

import { MANIFEST_FILENAME, MANIFEST_SCHEMA_VERSION, type PreregisteredScriptsManifest } from './hasher';

/**
 * Fetches and validates the build-time manifest shipped next to the
 * artifacts. It lists the rule hashes with matching generated files and the
 * scriptlet name → function-file map.
 *
 * @param scriptsPath Extension-relative path to the preregistered scripts
 * directory.
 *
 * @returns Parsed manifest, or `null` when unavailable, malformed, or
 * written under a newer schema version than the runtime understands.
 */
export const readManifest = async (scriptsPath: string): Promise<PreregisteredScriptsManifest | null> => {
    try {
        const url = chrome.runtime.getURL(`${scriptsPath}/${MANIFEST_FILENAME}`);
        const response = await fetch(url);

        if (!response.ok) {
            logger.warn(`[tsweb.manifest-reader]: No manifest at ${url} (status ${response.status})`);
            return null;
        }

        const manifest = await response.json();

        if (!manifest || !Array.isArray(manifest.hashes)) {
            logger.warn(`[tsweb.manifest-reader]: Malformed manifest at ${url}`);
            return null;
        }

        const schemaVersion = manifest.schemaVersion ?? 0;
        if (schemaVersion > MANIFEST_SCHEMA_VERSION) {
            logger.warn(`[tsweb.manifest-reader]: Unsupported manifest schema version ${schemaVersion} at ${url}`);
            return null;
        }

        const scriptletFiles = Object.create(null) as Record<string, string>;

        if (manifest.scriptletFiles) {
            for (const [name, file] of Object.entries(manifest.scriptletFiles)) {
                if (typeof file === 'string') {
                    scriptletFiles[name] = file;
                }
            }
        }

        return {
            hashes: manifest.hashes,
            scriptletFiles,
        };
    } catch (e) {
        logger.warn('[tsweb.manifest-reader]: Failed to load manifest', e);
        return null;
    }
};
