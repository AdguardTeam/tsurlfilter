import { logger } from '../../../common/utils/logger';
import { appContext } from '../app-context';
import { type ContentScriptDescriptor, ContentScriptManager } from '../content-script-manager';

import { getRuleHashFromFilePath } from './hasher';

/**
 * Derives the covered rule hashes per hostname from content-script
 * descriptors, ignoring non-rule files (shared bundle, per-function
 * `s-*.js`, cleanup).
 *
 * @param descriptors Content-script descriptors.
 *
 * @returns Hostname → covered hashes map.
 */
export const deriveCoverage = (
    descriptors: ContentScriptDescriptor[],
): Map<string, Set<string>> => {
    const coverage = new Map<string, Set<string>>();
    for (const descriptor of descriptors) {
        const hashes = new Set<string>();
        for (const filePath of descriptor.js ?? []) {
            const hash = getRuleHashFromFilePath(filePath);
            if (hash) {
                hashes.add(hash);
            }
        }
        coverage.set(descriptor.id, hashes);
    }

    return coverage;
};

/**
 * Reads the currently active registrations of the given namespace and
 * derives the covered rule hashes per hostname from their file lists.
 *
 * Chrome clears persistent registrations on install and update, so an
 * active registration always belongs to the current extension version
 * and its file list points at files of the current package: a
 * registration never outlives the files it references. A hash from a
 * dropped rule is harmless: the rule no longer exists in the engine, so
 * dynamic injection would not have it either.
 *
 * @param namespace Namespace of the preregistered scripts.
 *
 * @returns Hostname → covered hashes map.
 *
 * @throws When reading the registrations fails.
 */
export const readActiveRegistrations = async (namespace: string): Promise<Map<string, Set<string>>> => {
    const descriptors = await ContentScriptManager.getRegistered(namespace);

    return deriveCoverage(descriptors);
};

/**
 * Recovers, per hostname, the hashes of rules covered by registrations
 * persisted from previous service-worker lifetimes — the coverage basis
 * for pre-existing tabs — and publishes the snapshot into the app context.
 *
 * A failed snapshot is NOT persisted into the app context, so the next
 * configure retries it instead of sticking with an empty map for the rest
 * of the service-worker lifetime.
 *
 * @param namespace Namespace of the preregistered scripts.
 */
export const snapshotBootRegistrations = async (namespace: string): Promise<void> => {
    try {
        appContext.preregisteredScriptRulesAtBoot = await readActiveRegistrations(namespace);
    } catch (e) {
        logger.error('[tsweb.registrations-reader]: Failed to snapshot preregistered scripts', e);
    }
};
