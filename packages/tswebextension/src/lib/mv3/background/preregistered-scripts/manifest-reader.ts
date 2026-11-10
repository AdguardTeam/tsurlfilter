import { isPlainHostname } from '../../../common/utils/hostname';

import {
    hashString,
    MANIFEST_FILENAME,
    MANIFEST_SCHEMA_VERSION,
    type PreregisteredScriptsManifest,
    SCRIPTLET_FUNCTION_FILENAME_REGEX,
} from './hasher';

/**
 * Timeout for fetching the build-time manifest. It is a local package file,
 * so a hanging request means the worker is stuck, not slow.
 */
const MANIFEST_FETCH_TIMEOUT_MS = 5000;

/**
 * Fingerprint of a filter without page exceptions. The build keeps a
 * fingerprint for every filter list and writes a conditions file only for the
 * filters whose set is not empty, so both maps must agree on that boundary.
 */
const EMPTY_FINGERPRINT = hashString('');

/**
 * Parsed manifests per scripts path, including failed reads. Artifacts are
 * immutable for the lifetime of an extension version, so a service worker
 * can reuse the parsed manifest across syncs instead of refetching it — and
 * a broken manifest must not stall every `configure()` for the fetch
 * timeout. Cleared only for tests or on a service-worker restart.
 */
const manifestCache = new Map<string, Promise<PreregisteredScriptsManifest>>();

/**
 * Clears the parsed manifest cache. Intended for tests.
 */
export const clearManifestCache = (): void => {
    manifestCache.clear();
};

/**
 * Validates the manifest shape. Only `schemaVersion` used to be checked,
 * which let a truncated write (`{"schemaVersion": 1}`) pass: an empty
 * `hashes` set degrades every rule, so the sync unregistered everything
 * instead of failing and keeping the previous registrations.
 *
 * @param value Parsed JSON value.
 * @param url Manifest URL, for error messages.
 *
 * @returns Resolves to the manifest, narrowed to
 * {@link PreregisteredScriptsManifest}.
 *
 * @throws If a field is missing or has the wrong type.
 */
const validateManifest = async (value: unknown, url: string): Promise<PreregisteredScriptsManifest> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error(`Malformed manifest at ${url}: expected an object`);
    }

    const {
        schemaVersion,
        hashes,
        scriptletFiles,
        dynamicHostnames,
        conditions,
        pageExceptions,
    } = value as Partial<PreregisteredScriptsManifest>;

    if (schemaVersion !== MANIFEST_SCHEMA_VERSION) {
        throw new Error(`Unsupported manifest schema version ${String(schemaVersion)} at ${url}`);
    }

    if (!Array.isArray(hashes) || !hashes.every((hash) => typeof hash === 'string')) {
        throw new Error(`Malformed manifest at ${url}: "hashes" must be an array of strings`);
    }

    if (typeof scriptletFiles !== 'object' || scriptletFiles === null || Array.isArray(scriptletFiles)) {
        throw new Error(`Malformed manifest at ${url}: "scriptletFiles" must be an object`);
    }

    for (const [name, file] of Object.entries(scriptletFiles)) {
        if (typeof file !== 'string' || !SCRIPTLET_FUNCTION_FILENAME_REGEX.test(file)) {
            throw new Error(`Malformed manifest at ${url}: scriptlet "${name}" must map to an s-*.js file name`);
        }
    }

    if (dynamicHostnames !== undefined
        && (!Array.isArray(dynamicHostnames)
            || !dynamicHostnames.every((hostname) => typeof hostname === 'string' && isPlainHostname(hostname)))) {
        throw new Error(`Malformed manifest at ${url}: "dynamicHostnames" must be an array of plain hostnames`);
    }

    if (!Array.isArray(conditions) || !conditions.every((filterId) => Number.isInteger(filterId) && filterId > 0)) {
        throw new Error(`Malformed manifest at ${url}: "conditions" must be an array of filter ids`);
    }

    if (typeof pageExceptions !== 'object' || pageExceptions === null || Array.isArray(pageExceptions)) {
        throw new Error(`Malformed manifest at ${url}: "pageExceptions" must be a filter id → fingerprint object`);
    }

    for (const [filterId, fingerprint] of Object.entries(pageExceptions)) {
        if (typeof fingerprint !== 'string' || fingerprint.length === 0) {
            throw new Error(`Malformed manifest at ${url}: filter "${filterId}" must map to a fingerprint`);
        }

        if (!/^[1-9]\d*$/.test(filterId)) {
            throw new Error(`Malformed manifest at ${url}: "pageExceptions" key "${filterId}" is not a filter id`);
        }
    }

    // The conditions list decides which files the runtime registers, so the
    // two maps must describe the same set: a filter whose exceptions were
    // baked but whose id is missing from `conditions` would pass the
    // fingerprint check while its `cond-{filterId}.js` is never registered,
    // and the page would silently lose those exceptions.
    const conditionIds = new Set(conditions.map(String));
    const emptyFingerprint = await EMPTY_FINGERPRINT;

    for (const filterId of conditionIds) {
        if (!(filterId in pageExceptions)) {
            throw new Error(`Malformed manifest at ${url}: "conditions" filter "${filterId}"`
                + ' has no fingerprint in "pageExceptions"');
        }
    }

    for (const [filterId, fingerprint] of Object.entries(pageExceptions)) {
        if (fingerprint !== emptyFingerprint && !conditionIds.has(filterId)) {
            throw new Error(`Malformed manifest at ${url}: "pageExceptions" filter "${filterId}"`
                + ' has no entry in "conditions"');
        }
    }

    return {
        schemaVersion,
        hashes,
        scriptletFiles,
        dynamicHostnames,
        pageExceptions,
        conditions,
    };
};

/**
 * Fetches and validates the manifest for a scripts path.
 *
 * @param scriptsPath Extension-relative path to the preregistered scripts
 * directory.
 *
 * @returns Parsed manifest.
 *
 * @throws If the manifest cannot be fetched, the fetch times out, or the
 * manifest shape is invalid.
 */
const fetchManifest = async (scriptsPath: string): Promise<PreregisteredScriptsManifest> => {
    const url = chrome.runtime.getURL(`${scriptsPath}/${MANIFEST_FILENAME}`);
    const response = await fetch(url, { signal: AbortSignal.timeout(MANIFEST_FETCH_TIMEOUT_MS) });

    if (!response.ok) {
        throw new Error(`Failed to fetch the manifest at ${url} (status ${response.status})`);
    }

    return validateManifest(await response.json(), url);
};

/**
 * Fetches the build-time manifest shipped next to the artifacts. It lists
 * the rule hashes with matching generated files, the scriptlet name →
 * function-file map, the ids of the filters whose page exceptions are
 * baked into conditions files and the fingerprint those exceptions were
 * baked from.
 *
 * The manifest is this package's own build output, but it is still
 * validated: a missing, unreadable, malformed, or version-mismatched
 * manifest is a broken build, and failing the sync keeps the previous
 * registrations instead of silently dropping them.
 *
 * @param scriptsPath Extension-relative path to the preregistered scripts
 * directory.
 *
 * @returns Parsed manifest.
 *
 * @throws If the manifest cannot be fetched, the fetch times out, or the
 * manifest shape is invalid.
 */
export const readManifest = (scriptsPath: string): Promise<PreregisteredScriptsManifest> => {
    const cached = manifestCache.get(scriptsPath);
    if (cached) {
        return cached;
    }

    const pending = fetchManifest(scriptsPath);
    // The cached promise outlives a detached caller: swallow the rejection
    // so it is reported only through the awaiting call sites.
    pending.catch(() => {});
    manifestCache.set(scriptsPath, pending);

    return pending;
};
