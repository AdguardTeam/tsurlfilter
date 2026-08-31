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
     * {@code get()} call fails.
     */
    private static async getExistingIds(namespace: string): Promise<Set<string>> {
        const existingScripts = await ContentScriptManager.get(namespace);
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
     * {@code get()} call fails, or if
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

        const prefixedScripts = newScripts.map((script) => ({
            ...script,
            id: ContentScriptManager.makeScriptId(namespace, script.id),
        }));

        try {
            await chrome.scripting.registerContentScripts(prefixedScripts);
            logger.debug(`[tsweb.ContentScriptManager.register]: Registered ${prefixedScripts.length} script(s) in "${namespace}"`);
        } catch (e) {
            logger.error(`[tsweb.ContentScriptManager.register]: Failed in "${namespace}": ${newScripts.map((s) => s.id).join(', ')}`, e);
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
     * {@code get()} call fails, or if
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

        const prefixedScriptIds = existingScriptIds.map((id) => ContentScriptManager.makeScriptId(namespace, id));

        try {
            await chrome.scripting.unregisterContentScripts({ ids: prefixedScriptIds });
            logger.debug(`[tsweb.ContentScriptManager.unregister]: Unregistered ${prefixedScriptIds.length} script(s) from "${namespace}"`);
        } catch (e) {
            logger.error(`[tsweb.ContentScriptManager.unregister]: Failed in "${namespace}": ${existingScriptIds.join(', ')}`, e);
            throw e;
        }
    }

    /**
     * Unregisters all content scripts registered under the given namespace.
     *
     * Delegates to the internal {@code get()} helper to retrieve all
     * currently registered script IDs, then to
     * {@link ContentScriptManager.unregister} to remove them. If no
     * scripts are registered under the namespace, the method returns
     * immediately without calling the chrome API.
     *
     * **Snapshot semantics**: The set of script IDs to unregister is a
     * snapshot taken at the point the internal {@code get()} helper is called.
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
     * internal {@code get()} call or
     * {@link ContentScriptManager.unregister} call fails.
     */
    public static async clear(namespace: string): Promise<void> {
        ContentScriptManager.validateNamespace(namespace);

        const allScripts = await ContentScriptManager.get(namespace);
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
     * Retrieves all content scripts currently registered under the given
     * namespace.
     *
     * Queries the chrome.scripting API and filters results by namespace
     * prefix. Returned script descriptors have their IDs stripped of the
     * namespace prefix (e.g., `"stealth:gpc"` → `"gpc"`).
     *
     * @param namespace Namespace string used to prefix script IDs.
     *
     * @returns Promise that resolves with an array of script descriptors
     * with their namespace prefix stripped from IDs.
     *
     * @throws {Error} If the namespace is invalid, or if
     * chrome.scripting.getRegisteredContentScripts fails.
     */
    private static async get(namespace: string): Promise<ContentScriptDescriptor[]> {
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
            logger.error(`[tsweb.ContentScriptManager.get]: Failed in "${namespace}"`, e);
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
     * point the internal {@code get()} helper is called. Concurrent
     * registrations that occur after that snapshot will not be affected.
     *
     * **Note**: This method treats the namespace as owned — it will
     * unregister any script matching the namespace prefix, including
     * scripts registered outside this manager. See the class-level
     * "Namespace ownership" note for details.
     *
     * **Partial failure**: Errors from individual operations (unregister,
     * register, update) are collected and returned — they are NOT thrown.
     * Callers should inspect the return value to detect partial failures.
     *
     * @param namespace Namespace string used to prefix script IDs.
     * @param desiredScripts The desired set of content scripts.
     *
     * @returns Promise that resolves with an array of rejected results if
     * any operations failed, or an empty array if all succeeded.
     *
     * @throws {Error} If the namespace is invalid, or if the internal
     * {@code get()} call fails.
     */
    public static async sync(
        namespace: string,
        desiredScripts: ContentScriptDescriptor[],
    ): Promise<PromiseRejectedResult[]> {
        ContentScriptManager.validateNamespace(namespace);

        const toRegisterScripts: ContentScriptDescriptor[] = [];
        const toUpdateScripts: ContentScriptDescriptor[] = [];

        const existingScripts = await ContentScriptManager.get(namespace);
        const existingMap = new Map<string, ContentScriptDescriptor>(
            existingScripts.map((script) => [script.id, script]),
        );

        for (const script of desiredScripts) {
            const scriptId = script.id;
            const existing = existingMap.get(scriptId);

            if (!existing) {
                toRegisterScripts.push(script);
            } else if (!isEqual(script, existing)) {
                toUpdateScripts.push(script);
            }

            existingMap.delete(scriptId);
        }

        const toRemoveIds = Array.from(existingMap.keys());

        const result = await Promise.allSettled([
            ContentScriptManager.unregister(namespace, toRemoveIds),
            ContentScriptManager.register(namespace, toRegisterScripts),
            ContentScriptManager.update(namespace, toUpdateScripts),
        ]);

        const errors = result.filter((r) => r.status === 'rejected');
        if (errors.length > 0) {
            const reasons = errors.map((e) => {
                const { reason } = e as PromiseRejectedResult;
                return reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
            });

            logger.error(`[tsweb.ContentScriptManager.sync]: ${errors.length} operation(s) failed:\n${reasons.join('\n---\n')}`);
        }

        return errors;
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
     * {@code get()} call fails.
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

        const errors = results.filter((r) => r.status === 'rejected');
        if (errors.length > 0) {
            const reasons = errors.map((e) => {
                const { reason } = e as PromiseRejectedResult;
                return reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
            });

            logger.error(`[tsweb.ContentScriptManager.upsert]: ${errors.length} operation(s) failed:\n${reasons.join('\n---\n')}`);
        }

        return errors;
    }
}
