import { logger } from '../../../common/utils/logger';
import { appContext } from '../app-context';
import { ContentScriptManager } from '../content-script-manager';

import { getRuleHashFromFilePath } from './hasher';

/**
 * Reads the currently active registrations of the given namespace and
 * derives the covered rule hashes per hostname from their file lists.
 *
 * @param namespace Namespace of the preregistered scripts.
 *
 * @returns Hostname → covered hashes map.
 *
 * @throws When reading the registrations fails.
 */
export const readActiveRegistrations = async (namespace: string): Promise<Map<string, Set<string>>> => {
    const descriptors = await ContentScriptManager.getRegistered(namespace);

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
 * Recovers, per hostname, the hashes of rules covered by registrations
 * persisted from previous service-worker lifetimes — the rules proven to
 * have executed at `document_start` in pre-existing tabs.
 *
 * A failed snapshot is NOT persisted into the app context, so the next
 * configure retries it instead of sticking with an empty map for the rest
 * of the service-worker lifetime.
 *
 * @param namespace Namespace of the preregistered scripts.
 *
 * @returns Hostname to covered rule hashes map, or `null` on failure.
 */
export const snapshotBootRegistrations = async (
    namespace: string,
): Promise<Map<string, Set<string>> | null> => {
    try {
        const snapshot = await readActiveRegistrations(namespace);
        if (snapshot !== null) {
            appContext.preregisteredScriptRulesAtBoot = snapshot;
        }
        return snapshot;
    } catch (e) {
        logger.error('[tsweb.registrations-reader]: Failed to snapshot preregistered scripts', e);
        return null;
    }
};
