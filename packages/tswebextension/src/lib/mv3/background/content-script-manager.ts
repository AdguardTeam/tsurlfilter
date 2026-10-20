import { isEqual } from 'lodash-es';

import { logger } from '../../common/utils/logger';

/**
 * Content script descriptor.
 *
 * Structurally mirrors {@link chrome.scripting.RegisteredContentScript}
 * rather than re-exporting it as a type alias. This avoids a hard
 * dependency on `@types/chrome`, so consumers (such as `adguard-api-mv3`)
 * do not need to install it to use this package.
 */
export interface ContentScriptDescriptor {
    /**
     * Unique identifier for the content script.
     */
    id: string;

    /**
     * Whether the script should inject into all frames.
     */
    allFrames?: boolean;

    /**
     * Whether to match the origin as a fallback when the URL is opaque.
     */
    matchOriginAsFallback?: boolean;

    /**
     * CSS files to inject.
     */
    css?: string[];

    /**
     * URL patterns that the script should NOT inject into.
     */
    excludeMatches?: string[];

    /**
     * JavaScript files to inject.
     */
    js?: string[];

    /**
     * URL patterns that the script should inject into.
     */
    matches?: string[];

    /**
     * Whether the script should persist across browser sessions.
     */
    persistAcrossSessions?: boolean;

    /**
     * When the script should be injected.
     */
    runAt?: 'document_start' | 'document_end' | 'document_idle';

    /**
     * The execution world for the script.
     */
    world?: 'ISOLATED' | 'MAIN';
}

/**
 * The separator used between namespace and original script ID to form
 * the chrome-level content script ID (e.g., `stealth:gpc`).
 */
const NAMESPACE_SEPARATOR = ':';

/**
 * Maximum number of per-item retries of a failed sync batch executed
 * concurrently: a batch can hold one entry per registered script, and an
 * unbounded fan-out of chrome API calls would strain the browser.
 */
const RETRY_BATCH_SIZE = 8;

/**
 * Fills in chrome.scripting's documented defaults for omitted optional
 * fields, so a `desired` descriptor and a descriptor returned by
 * `getRegisteredContentScripts()` compare equal when nothing changed.
 *
 * @param script Descriptor to normalize.
 *
 * @returns Canonical descriptor with all optional fields explicit.
 */
const canonicalize = (script: ContentScriptDescriptor): Required<ContentScriptDescriptor> => {
    return {
        id: script.id,
        allFrames: script.allFrames ?? false,
        matchOriginAsFallback: script.matchOriginAsFallback ?? false,
        css: [...script.css ?? []],
        excludeMatches: [...script.excludeMatches ?? []],
        js: [...script.js ?? []],
        matches: [...script.matches ?? []],
        persistAcrossSessions: script.persistAcrossSessions ?? true,
        runAt: script.runAt ?? 'document_idle',
        world: script.world ?? 'ISOLATED',
    };
};

/**
 * Result of {@link ContentScriptManager.sync}.
 */
export interface SyncScriptsResult {
    /**
     * Errors from failed operations (already logged). Empty when everything
     * succeeded.
     */
    errors: PromiseRejectedResult[];

    /**
     * Original (unprefixed) IDs of desired scripts whose desired state is
     * not guaranteed after the call: failed registrations (no registration
     * active), failed updates (stale registration active) and failed
     * unregistrations (stale registration still active).
     */
    failedScriptIds: string[];
}

/**
 * A settled sync batch operation together with the items it consisted of.
 *
 * @template T Type of the batch items.
 */
type SettledBatch<T> = {
    result: PromiseSettledResult<void>;
    items: T[];
};

/**
 * Settled results of the three batch operations of
 * {@link ContentScriptManager.sync}, together with the items each
 * batch consisted of.
 */
type SyncBatchResults = {
    unregister: SettledBatch<string>;
    register: SettledBatch<ContentScriptDescriptor>;
    update: SettledBatch<ContentScriptDescriptor>;
};

/**
 * Manages dynamic content script registration via the chrome.scripting API.
 *
 * This class is not instantiable — all methods are static and accept a
 * `namespace` parameter that is used to prefix chrome-level content script
 * IDs as `namespace:originalId`, preventing ID conflicts between different
 * services that register content scripts independently.
 *
 * **Concurrency**: Methods are not internally synchronized. If callers need
 * to ensure atomicity across multiple operations, they must coordinate
 * externally.
 *
 * **Namespace ownership**: A namespace implies ownership of *all* content
 * scripts whose chrome-level IDs start with `namespace:`. Methods like
 * {@link ContentScriptManager.sync} and {@link ContentScriptManager.clear}
 * will unregister any script matching the prefix — including scripts
 * registered outside this manager. Do not co-register scripts under a
 * namespace prefix you do not own.
 *
 * @example
 * ```typescript
 * await ContentScriptManager.register('stealth', scripts);
 * await ContentScriptManager.update('stealth', scripts);
 * await ContentScriptManager.clear('stealth');
 * await ContentScriptManager.sync('stealth', scripts);
 * ```
 */
export class ContentScriptManager {
    /**
     * Validates that a namespace string is non-empty (including
     * whitespace-only strings) and does not contain the namespace
     * separator (`:`) which would cause ambiguous script IDs.
     *
     * @param namespace The namespace string to validate.
     *
     * @throws {Error} If the namespace is empty, whitespace-only, or
     * contains `:`.
     */
    private static validateNamespace(namespace: string): void {
        if (!namespace || namespace.trim() === '') {
            throw new Error('Namespace must not be empty');
        }

        if (namespace.includes(NAMESPACE_SEPARATOR)) {
            throw new Error(`Namespace "${namespace}" contains forbidden character '${NAMESPACE_SEPARATOR}'`);
        }
    }

    /**
     * Derives the prefixed content script ID by prepending the namespace
     * string and separator to the original ID.
     *
     * @param namespace The namespace string (e.g., `"stealth"`).
     * @param originalId Original (consumer-provided) script ID.
     *
     * @returns Prefixed ID (e.g., `"stealth:gpc"`).
     */
    private static makeScriptId(namespace: string, originalId: string): string {
        return `${namespace}${NAMESPACE_SEPARATOR}${originalId}`;
    }

    /**
     * Strips the namespace prefix from a chrome-level content script ID
     * to recover the original ID.
     *
     * @param namespace The namespace string (e.g., `"stealth"`).
     * @param chromeId Chrome-level prefixed ID (e.g., `"stealth:gpc"`).
     *
     * @returns Original ID (e.g., `"gpc"`).
     */
    private static stripNamespacePrefix(namespace: string, chromeId: string): string {
        return chromeId.slice(namespace.length + NAMESPACE_SEPARATOR.length);
    }

    /**
     * Checks whether a chrome-level content script ID belongs to the given
     * namespace by testing if it starts with `namespace:`.
     *
     * @param namespace The namespace string (e.g., `"stealth"`).
     * @param script Content script descriptor whose `id` field is checked.
     *
     * @returns `true` if the script ID starts with the namespace prefix.
     */
    private static isOwnScript(namespace: string, script: ContentScriptDescriptor): boolean {
        return script.id.startsWith(`${namespace}${NAMESPACE_SEPARATOR}`);
    }

    /**
     * Retrieves the set of currently registered script IDs under the given
     * namespace.
     *
     * @param namespace Namespace string used to prefix script IDs.
     *
     * @returns Promise that resolves with a Set of existing script IDs
     * (without namespace prefix).
     *
     * @throws {Error} If the namespace is invalid, or if the internal
     * {@code getRegistered()} call fails.
     */
    private static async getExistingIds(namespace: string): Promise<Set<string>> {
        const existingScripts = await ContentScriptManager.getRegistered(namespace);
        return new Set(existingScripts.map((script) => script.id));
    }

    /**
     * Registers content scripts under the given namespace.
     *
     * Each script's `id` is auto-prefixed with the namespace before
     * registration. Only scripts that are not already registered under
     * the namespace will be registered; existing scripts are silently
     * skipped. If the `scripts` array is empty or all scripts already
     * exist, the method returns immediately without calling the chrome API.
     *
     * @param namespace Namespace string used to prefix script IDs.
     * @param scripts Array of content script descriptors to register.
     *
     * @returns Promise that resolves when all new scripts are registered.
     *
     * @throws {Error} If the namespace is invalid, if the internal
     * {@code getRegistered()} call fails, or if
     * chrome.scripting.registerContentScripts fails (e.g., invalid match
     * pattern or duplicate script ID).
     */
    public static async register(namespace: string, scripts: ContentScriptDescriptor[]): Promise<void> {
        ContentScriptManager.validateNamespace(namespace);

        if (scripts.length === 0) {
            return;
        }

        const existingIds = await ContentScriptManager.getExistingIds(namespace);
        const newScripts = scripts.filter((script) => !existingIds.has(script.id));

        if (newScripts.length === 0) {
            logger.debug(`[tsweb.ContentScriptManager.register]: All scripts already registered in "${namespace}"`);
            return;
        }

        await ContentScriptManager.registerScripts(namespace, newScripts);
    }

    /**
     * Registers scripts known to be missing from the namespace, without an
     * existence check — used by the sync batches and their per-item
     * retries, which rely on the sync snapshot instead of re-listing the
     * registrations for every item. A no-op for an empty list.
     *
     * @param namespace Namespace string used to prefix script IDs.
     * @param scripts Scripts to register.
     *
     * @throws If chrome.scripting.registerContentScripts fails.
     */
    private static async registerScripts(namespace: string, scripts: ContentScriptDescriptor[]): Promise<void> {
        if (scripts.length === 0) {
            return;
        }

        const prefixedScripts = scripts.map((script) => ({
            ...script,
            id: ContentScriptManager.makeScriptId(namespace, script.id),
        }));

        try {
            await chrome.scripting.registerContentScripts(prefixedScripts);
            logger.debug(`[tsweb.ContentScriptManager.registerScripts]: Registered ${prefixedScripts.length} script(s) in "${namespace}"`);
        } catch (e) {
            logger.error(`[tsweb.ContentScriptManager.registerScripts]: Failed in "${namespace}": ${scripts.map((s) => s.id).join(', ')}`, e);
            throw e;
        }
    }

    /**
     * Unregisters content scripts by their IDs within the given
     * namespace.
     *
     * Only scripts that are currently registered under the namespace
     * will be unregistered; non-existent script IDs are silently skipped.
     * If the `scriptIds` array is empty or none of the scripts exist,
     * the method returns immediately without calling the chrome API.
     *
     * @param namespace Namespace string used to prefix script IDs.
     * @param scriptIds Array of original (consumer-provided) script IDs.
     *
     * @returns Promise that resolves when all existing scripts are
     * unregistered.
     *
     * @throws {Error} If the namespace is invalid, if the internal
     * {@code getRegistered()} call fails, or if
     * chrome.scripting.unregisterContentScripts fails.
     */
    public static async unregister(namespace: string, scriptIds: string[]): Promise<void> {
        ContentScriptManager.validateNamespace(namespace);

        if (scriptIds.length === 0) {
            return;
        }

        const existingIds = await ContentScriptManager.getExistingIds(namespace);
        const existingScriptIds = scriptIds.filter((id) => existingIds.has(id));

        if (existingScriptIds.length === 0) {
            logger.debug(`[tsweb.ContentScriptManager.unregister]: No scripts found to unregister in "${namespace}"`);
            return;
        }

        await ContentScriptManager.unregisterScripts(namespace, existingScriptIds);
    }

    /**
     * Unregisters scripts known to be registered, without an existence
     * check — used by the sync batches and their per-item retries, which
     * rely on the sync snapshot instead of re-listing the registrations
     * for every item. A no-op for an empty list.
     *
     * @param namespace Namespace string used to prefix script IDs.
     * @param scriptIds Original (consumer-provided) script IDs.
     *
     * @throws If chrome.scripting.unregisterContentScripts fails.
     */
    private static async unregisterScripts(namespace: string, scriptIds: string[]): Promise<void> {
        if (scriptIds.length === 0) {
            return;
        }

        const prefixedScriptIds = scriptIds.map((id) => ContentScriptManager.makeScriptId(namespace, id));

        try {
            await chrome.scripting.unregisterContentScripts({ ids: prefixedScriptIds });
            logger.debug(`[tsweb.ContentScriptManager.unregisterScripts]: Unregistered ${prefixedScriptIds.length} script(s) from "${namespace}"`);
        } catch (e) {
            logger.error(`[tsweb.ContentScriptManager.unregisterScripts]: Failed in "${namespace}": ${scriptIds.join(', ')}`, e);
            throw e;
        }
    }

    /**
     * Unregisters all content scripts registered under the given namespace.
     *
     * Delegates to the internal {@code getRegistered()} helper to retrieve
     * all currently registered script IDs, then to
     * {@link ContentScriptManager.unregister} to remove them. If no
     * scripts are registered under the namespace, the method returns
     * immediately without calling the chrome API.
     *
     * **Snapshot semantics**: The set of script IDs to unregister is a
     * snapshot taken at the point the internal {@code getRegistered()}
     * helper is called.
     * Concurrent registrations that occur after that snapshot will not be
     * affected by this call.
     *
     * **Note**: This method removes *all* scripts matching the namespace
     * prefix, including any registered outside this manager. See the
     * class-level "Namespace ownership" note for details.
     *
     * @param namespace Namespace string used to prefix script IDs.
     *
     * @returns Promise that resolves when all scripts are unregistered.
     *
     * @throws {Error} If the namespace is invalid, or if any delegated
     * internal {@code getRegistered()} call or
     * {@link ContentScriptManager.unregister} call fails.
     */
    public static async clear(namespace: string): Promise<void> {
        ContentScriptManager.validateNamespace(namespace);

        const allScripts = await ContentScriptManager.getRegistered(namespace);
        if (allScripts.length === 0) {
            return;
        }

        const ownIds = allScripts.map((script) => script.id);

        try {
            await ContentScriptManager.unregister(namespace, ownIds);
            logger.debug(`[tsweb.ContentScriptManager.clear]: Cleared ${ownIds.length} script(s) from "${namespace}"`);
        } catch (e) {
            logger.error(`[tsweb.ContentScriptManager.clear]: Failed in "${namespace}": ${ownIds.join(', ')}`, e);
            throw e;
        }
    }

    /**
     * Returns the full descriptors of all content scripts currently
     * registered under the given namespace, IDs stripped of the namespace
     * prefix. The descriptors include the `js` file lists, which some
     * consumers need (e.g. to recover per-rule hashes from persisted
     * registrations).
     *
     * @param namespace Namespace string used to prefix script IDs.
     *
     * @returns Promise that resolves with the registered script descriptors.
     *
     * @throws {Error} If the namespace is invalid, or if
     * chrome.scripting.getRegisteredContentScripts fails.
     */
    public static async getRegistered(namespace: string): Promise<ContentScriptDescriptor[]> {
        ContentScriptManager.validateNamespace(namespace);

        try {
            const allScripts = await chrome.scripting.getRegisteredContentScripts();

            return (allScripts ?? [])
                .filter((script) => ContentScriptManager.isOwnScript(namespace, script))
                .map((script) => ({
                    ...script,
                    id: ContentScriptManager.stripNamespacePrefix(namespace, script.id),
                }));
        } catch (e) {
            logger.error(`[tsweb.ContentScriptManager.getRegistered]: Failed in "${namespace}"`, e);
            throw e;
        }
    }

    /**
     * Reconciles the actual state of registered content scripts with the
     * desired state for the given namespace.
     *
     * Uses a diff-based approach: scripts present in the desired set but
     * missing from the current state are registered; scripts present in
     * the current state but missing from the desired set are unregistered;
     * scripts present in both are updated via
     * `chrome.scripting.updateContentScripts` only if their descriptor
     * has changed. This avoids unnecessary unregister/register cycles
     * for unchanged scripts.
     *
     * **Snapshot semantics**: The current state is a snapshot taken at the
     * point the internal {@code getRegistered()} helper is called. Concurrent
     * registrations that occur after that snapshot will not be affected.
     *
     * **Note**: This method treats the namespace as owned — it will
     * unregister any script matching the namespace prefix, including
     * scripts registered outside this manager. See the class-level
     * "Namespace ownership" note for details.
     *
     * **Batch failure**: the chrome API rejects a batched call as a unit
     * (one bad entry fails them all), so a failed batch is retried per
     * item; only items whose retry also fails land in
     * {@link SyncScriptsResult.failedScriptIds}.
     *
     * @param namespace Namespace string used to prefix script IDs.
     * @param desiredScripts The desired set of content scripts.
     *
     * @returns Promise that resolves with the per-script sync result.
     *
     * @throws {Error} If the namespace is invalid, or if the internal
     * {@code getRegistered()} call fails.
     */
    public static async sync(
        namespace: string,
        desiredScripts: ContentScriptDescriptor[],
    ): Promise<SyncScriptsResult> {
        ContentScriptManager.validateNamespace(namespace);

        const toRegisterScripts: ContentScriptDescriptor[] = [];
        const toUpdateScripts: ContentScriptDescriptor[] = [];

        const existingScripts = await ContentScriptManager.getRegistered(namespace);
        const existingMap = new Map<string, ContentScriptDescriptor>(
            existingScripts.map((script) => [script.id, script]),
        );

        for (const script of desiredScripts) {
            const scriptId = script.id;
            const existing = existingMap.get(scriptId);

            if (!existing) {
                toRegisterScripts.push(script);
            } else if (!isEqual(canonicalize(script), canonicalize(existing))) {
                toUpdateScripts.push(script);
            }

            existingMap.delete(scriptId);
        }

        const toRemoveIds = Array.from(existingMap.keys());

        const [unregisterResult, registerResult, updateResult] = await Promise.allSettled([
            ContentScriptManager.unregisterScripts(namespace, toRemoveIds),
            ContentScriptManager.registerScripts(namespace, toRegisterScripts),
            ContentScriptManager.update(namespace, toUpdateScripts),
        ]);

        const { errors, failedScriptIds } = await ContentScriptManager.retryFailedBatches(namespace, {
            unregister: { result: unregisterResult, items: toRemoveIds },
            register: { result: registerResult, items: toRegisterScripts },
            update: { result: updateResult, items: toUpdateScripts },
        });

        if (errors.length > 0) {
            const reasons = errors.map(({ reason }) => {
                return reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
            });

            logger.error(`[tsweb.ContentScriptManager.sync]: ${errors.length} operation(s) failed:\n${reasons.join('\n---\n')}`);
        }

        return { errors, failedScriptIds };
    }

    /**
     * Processes the settled batch operations of a sync: retries each
     * rejected batch per item to isolate the failures to the offending
     * scripts. Retries call the chrome API directly with the IDs known
     * from the sync snapshot — a fresh existence check per item would
     * multiply the full registration listing by the batch size.
     *
     * @param namespace Namespace string used to prefix script IDs.
     * @param batches Settled results together with the items each batch
     * consisted of.
     *
     * @returns Batch errors and the IDs of items whose individual retry
     * also failed.
     */
    private static async retryFailedBatches(
        namespace: string,
        batches: SyncBatchResults,
    ): Promise<SyncScriptsResult> {
        const { unregister, register, update } = batches;

        const results = await Promise.all([
            ContentScriptManager.retryFailedBatch(
                unregister,
                (id) => ContentScriptManager.unregisterScripts(namespace, [id]),
                (id) => id,
            ),
            ContentScriptManager.retryFailedBatch(
                register,
                (script) => ContentScriptManager.registerScripts(namespace, [script]),
                (script) => script.id,
            ),
            ContentScriptManager.retryFailedBatch(
                update,
                (script) => ContentScriptManager.update(namespace, [script]),
                (script) => script.id,
            ),
        ]);

        return {
            errors: results.flatMap((result) => result.errors),
            failedScriptIds: results.flatMap((result) => result.failedIds),
        };
    }

    /**
     * Retries a rejected batch per item in chunks of
     * {@link RETRY_BATCH_SIZE} — one chrome API call per item is cheap,
     * but an unbounded concurrent fan-out is not. A batch rejection is
     * recorded as an error only when its per-item retry also failed: a
     * fully healed batch is not an error.
     *
     * @param batch Settled batch result together with the items it
     * consisted of.
     * @param operation Operation to retry for a single item.
     * @param getId Extracts the script ID from an item.
     *
     * @returns Batch errors and the IDs of items whose individual retry
     * was rejected.
     */
    private static async retryFailedBatch<T>(
        batch: SettledBatch<T>,
        operation: (item: T) => Promise<void>,
        getId: (item: T) => string,
    ): Promise<{ errors: PromiseRejectedResult[]; failedIds: string[] }> {
        if (batch.result.status !== 'rejected') {
            return { errors: [], failedIds: [] };
        }

        const failedIds: string[] = [];

        for (let i = 0; i < batch.items.length; i += RETRY_BATCH_SIZE) {
            const chunk = batch.items.slice(i, i + RETRY_BATCH_SIZE);

            // eslint-disable-next-line no-await-in-loop
            const retries = await Promise.allSettled(chunk.map((item) => operation(item)));

            retries.forEach((retry, index) => {
                if (retry.status === 'rejected') {
                    failedIds.push(getId(chunk[index]));
                }
            });
        }

        return {
            errors: failedIds.length > 0 ? [batch.result] : [],
            failedIds,
        };
    }

    /**
     * Updates multiple content scripts under the given namespace.
     *
     * Uses `chrome.scripting.updateContentScripts`.
     * Scripts passed to this method **must** already be registered under
     * the namespace. Use {@link ContentScriptManager.register} for new
     * scripts or {@link ContentScriptManager.sync} for full reconciliation.
     *
     * @param namespace Namespace string used to prefix script IDs.
     * @param scripts Array of content script descriptors to update.
     *
     * @returns Promise that resolves when the scripts are updated.
     *
     * @throws {Error} If the namespace is invalid, if the update operation
     * fails, or if any script in `scripts` is not currently registered.
     */
    public static async update(namespace: string, scripts: ContentScriptDescriptor[]): Promise<void> {
        ContentScriptManager.validateNamespace(namespace);

        if (scripts.length === 0) {
            return;
        }

        try {
            await chrome.scripting.updateContentScripts(
                scripts.map((script) => {
                    const prefixedId = ContentScriptManager.makeScriptId(namespace, script.id);
                    return { ...script, id: prefixedId };
                }),
            );
            logger.debug(`[tsweb.ContentScriptManager.update]: Updated "${namespace}": ${scripts.map((s) => s.id)}`);
        } catch (e) {
            logger.error(`[tsweb.ContentScriptManager.update]: Failed in "${namespace}": ${scripts.map((s) => s.id)}`, e);
            throw e;
        }
    }

    /**
     * Upserts content scripts under the given namespace.
     *
     * For each script, checks if it's already registered under the namespace.
     * If registered, updates it via `chrome.scripting.updateContentScripts`.
     * If not registered, registers it via `chrome.scripting.registerContentScripts`.
     *
     * This method is useful when you want to ensure scripts are in a specific
     * state without needing to know their current registration status.
     *
     * **Partial failure**: Errors from individual operations (register, update)
     * are collected and returned — they are NOT thrown. Callers should inspect
     * the return value to detect partial failures.
     *
     * @param namespace Namespace string used to prefix script IDs.
     * @param scripts Array of content script descriptors to upsert.
     *
     * @returns Promise that resolves with an array of rejected results if
     * any operations failed, or an empty array if all succeeded.
     *
     * @throws {Error} If the namespace is invalid, or if the internal
     * {@code getRegistered()} call fails.
     */
    public static async upsert(
        namespace: string,
        scripts: ContentScriptDescriptor[],
    ): Promise<PromiseRejectedResult[]> {
        ContentScriptManager.validateNamespace(namespace);

        if (scripts.length === 0) {
            return [];
        }

        const existingIds = await ContentScriptManager.getExistingIds(namespace);

        const toRegister: ContentScriptDescriptor[] = [];
        const toUpdate: ContentScriptDescriptor[] = [];

        for (const script of scripts) {
            if (existingIds.has(script.id)) {
                toUpdate.push(script);
            } else {
                toRegister.push(script);
            }
        }

        const operations: Promise<void>[] = [];

        if (toRegister.length > 0) {
            operations.push(ContentScriptManager.register(namespace, toRegister));
        }

        if (toUpdate.length > 0) {
            operations.push(ContentScriptManager.update(namespace, toUpdate));
        }

        if (operations.length === 0) {
            return [];
        }

        const results = await Promise.allSettled(operations);

        const errors = results.filter(
            (r): r is PromiseRejectedResult => r.status === 'rejected',
        );
        if (errors.length > 0) {
            const reasons = errors.map(({ reason }) => {
                return reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
            });

            logger.error(`[tsweb.ContentScriptManager.upsert]: ${errors.length} operation(s) failed:\n${reasons.join('\n---\n')}`);
        }

        return errors;
    }
}
