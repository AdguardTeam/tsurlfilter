import { type IDBPDatabase } from 'idb';
import browser from 'webextension-polyfill';

import {
    extractRulesetId,
    getRulesetId,
    getRulesetPath,
    type IFilter,
    type IRulesetWithSourceMap,
    METADATA_RULESET_ID,
    MetadataRuleset,
    Rule,
    RulesetWithSourceMap,
    RulesHashMap,
} from '@adguard/dnr-converter';
import { fetchExtensionResourceText, FilterList } from '@adguard/tsurlfilter';

import { IdbSingleton } from '../../common/idb-singleton';
import { FiltersStorage } from '../../common/storage/filters';
import { logger } from '../../common/utils/logger';

/**
 * RulesetsLoaderApi is responsible for creating {@link IRulesetWithSourceMap} instances
 * from provided rule set IDs and paths.
 * It supports lazy loading, meaning the rule set contents are loaded only upon request.
 * This class implements a two-layer caching strategy to optimize performance:
 * ## Caching Architecture:
 * 1. **IDB (IndexedDB) Cache**: Temporary storage that is cleared on each service worker restart
 *    - Stores checksums, metadata, lazy metadata, and declarative rules
 *    - Keys format: `<prefix>_<rulesetId>` (e.g., `checksum_123`).
 *    - Cache lifetime is bound to service worker lifecycle for predictable behavior.
 *
 * 2. **In-Memory Cache**: Fast access layer for frequently accessed data within a session
 *    - `idbChecksumsCache`: Caches checksums from IDB with composite keys `<rulesetsPath>_<rulesetId>`
 *    - `rulesetsCache`: Caches fully created IRulesetWithSourceMap instances
 *    - `metadataRulesetsCache`: Caches metadata rule sets by path
 *
 * ## Cache Synchronization:
 * The source of truth for data freshness is the checksum extracted from files on disk.
 * When checksums don't match, both cache layers are updated atomically.
 * All cached data is dropped on service worker restart to ensure clean state.
 *
 * The main functionalities include:
 * - Initializing the rule sets loader to prepare it for fetching rule sets.
 * - Fetching checksums of rule sets from disk (source of truth).
 * - Synchronizing rule sets with IDB when checksums change.
 * - Creating new {@link IRulesetWithSourceMap} instances with lazy loading capabilities.
 *
 * @example
 * ```typescript
 * const loader = new RulesetsLoaderApi('/path/to/rulesets');
 * await loader.initialize();
 * const ruleset = await loader.createRuleset('123', filters);
 * ```
 */
export class RulesetsLoaderApi {
    /**
     * Database store name.
     */
    private static readonly DB_STORE_NAME = 'rulesets';

    /**
     * Combiner for key prefix and rule set id.
     */
    private static readonly KEY_COMBINER = '_';

    /**
     * Prefix for checksum key.
     */
    private static readonly KEY_PREFIX_CHECKSUM = 'checksum';

    /**
     * Prefix for metadata rule set key.
     */
    private static readonly KEY_PREFIX_RULESET_METADATA = 'metadata';

    /**
     * Prefix for lazy metadata rule set key.
     */
    private static readonly KEY_PREFIX_RULESET_LAZY_METADATA = 'lazyMetadata';

    /**
     * Prefix for declarative rules key.
     */
    private static readonly KEY_PREFIX_RULESET_DECLARATIVE_RULES = 'declarativeRules';

    /**
     * Cache of metadata rule sets.
     */
    private static metadataRulesetsCache: Record<string, MetadataRuleset> = {};

    /**
     * Cache for already created rulesets. Needed to avoid multiple loading
     * of the same ruleset.
     */
    private static rulesetsCache: Map<string, IRulesetWithSourceMap>;

    /**
     * Path to rule sets cache directory to invalidate it when path changes.
     */
    private static rulesetsCachePath: string;

    /**
     * Path to rule sets directory.
     */
    private rulesetsPath: string;

    /**
     * Indicates whether the rule sets loader is initialized.
     */
    private isInitialized: boolean;

    /**
     * Promise that resolves when the initialization is complete.
     * This helps prevent multiple fetches by ensuring {@link RulesetsLoaderApi.initialize}
     * is only called once, even if invoked multiple times in quick succession.
     */
    private initializerPromise: Promise<void> | undefined;

    /**
     * Cache of checksums retrieved from IDB to avoid repeated database queries.
     * Key format: `<rulesetsPath>_<rulesetId>` (e.g., `/path/to/rules_123`)
     * Only stores actual checksum values found in IDB, never undefined.
     * This cache is shared across all instances of the class.
     */
    private static idbChecksumsCache = new Map<string, string>();

    /**
     * Race condition lock map per rulesetId.
     * Made static to prevent concurrent syncs across different instances.
     */
    private static syncLocks = new Map<string, Promise<void>>();

    /**
     * Creates new {@link RulesetsLoaderApi}.
     *
     * @param rulesetsPath Path to rule sets directory.
     */
    constructor(rulesetsPath: string) {
        this.rulesetsPath = rulesetsPath;
        this.isInitialized = false;

        if (RulesetsLoaderApi.rulesetsCachePath !== rulesetsPath) {
            RulesetsLoaderApi.rulesetsCachePath = rulesetsPath;
            RulesetsLoaderApi.rulesetsCache = new Map();
        }
    }

    /**
     * Returns key with prefix.
     * Key format: <prefix>_<rulesetId>, e.g. `metadata_123`.
     *
     * @param keyPrefix Key prefix.
     * @param rulesetId Rule set id.
     *
     * @returns Key with prefix.
     */
    private static getKey(keyPrefix: string, rulesetId: number | string): string {
        return `${keyPrefix}${RulesetsLoaderApi.KEY_COMBINER}${rulesetId}`;
    }

    /**
     * Returns opened database.
     *
     * @param store Database store name.
     *
     * @returns Promise, resolved with opened database.
     */
    private static async getOpenedDb(store: string): Promise<IDBPDatabase> {
        return IdbSingleton.getOpenedDb(store, () => {
            RulesetsLoaderApi.idbChecksumsCache.clear();
        });
    }

    /**
     * Gets the value from the IDB database.
     *
     * @param key The key to look up.
     *
     * @returns The value associated with the key, or undefined if the key is not found.
     */
    private static async getValueFromIdb(key: string): Promise<any | undefined> {
        const db = await RulesetsLoaderApi.getOpenedDb(RulesetsLoaderApi.DB_STORE_NAME);
        const tx = db.transaction(RulesetsLoaderApi.DB_STORE_NAME, 'readonly');
        const store = tx.objectStore(RulesetsLoaderApi.DB_STORE_NAME);

        const value = await store.get(key);

        await tx.done;

        return value;
    }

    /**
     * Gets the checksums of the rule sets.
     *
     * @param rulesetId Rule set id.
     *
     * @returns Checksums of the rule sets.
     *
     * @throws If the rule sets loader is not initialized or the checksum for the specified rule set is not found.
     */
    private async getChecksum(rulesetId: string | number): Promise<string | undefined> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const rulesetIdWithPrefix = getRulesetId(rulesetId);

        return RulesetsLoaderApi.metadataRulesetsCache[this.rulesetsPath]?.getChecksum(rulesetIdWithPrefix);
    }

    /**
     * Initializes the rule sets loader.
     * It loads the metadata ruleset which contains checksums and other metadata
     * needed for rule set management and caching.
     *
     * @throws Error if the metadata ruleset file is not found or its content is invalid.
     */
    private async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        if (this.initializerPromise) {
            await this.initializerPromise;
            return;
        }

        const initialize = async (): Promise<void> => {
            try {
                if (!RulesetsLoaderApi.metadataRulesetsCache[this.rulesetsPath]) {
                    const metadataRulesetPath = getRulesetPath(METADATA_RULESET_ID, this.rulesetsPath);
                    const rawMetadataRuleset = await fetchExtensionResourceText(
                        browser.runtime.getURL(metadataRulesetPath),
                    );
                    // eslint-disable-next-line max-len
                    RulesetsLoaderApi.metadataRulesetsCache[this.rulesetsPath] = MetadataRuleset.deserialize(rawMetadataRuleset);
                }

                this.isInitialized = true;
                this.initializerPromise = undefined;
            } catch (error) {
                logger.error('[tsweb.RulesetsLoaderApi.initialize]: failed to initialize. Got error: ', error);
                throw error;
            }
        };

        this.initializerPromise = initialize();

        await this.initializerPromise;
    }

    /**
     * Synchronizes the rule set with the IDB database.
     * This method ensures that the rule set is up-to-date in the IDB database.
     * If the rule set is not found in the IDB database, it will be added.
     * If the rule set is found but its checksum does not match, it will be updated.
     *
     * @param rulesetId Rule set id.
     */
    public async syncRulesetWithIdb(rulesetId: string): Promise<void> {
        // Use a per-ruleset lock to avoid parallel syncs
        const existingLock = RulesetsLoaderApi.syncLocks.get(rulesetId);
        if (existingLock) {
            await existingLock;
            return;
        }

        const syncPromise = (async (): Promise<void> => {
            try {
                if (!this.isInitialized) {
                    await this.initialize();
                }

                const checksum = await this.getChecksum(rulesetId);
                if (!checksum) {
                    logger.error(`[tsweb.RulesetsLoaderApi.syncRulesetWithIdb]: Failed to get checksum for rule set: ${rulesetId}`);
                    return;
                }

                let idbChecksum: string | undefined;

                const cacheKey = `${this.rulesetsPath}_${rulesetId}`;

                // Check cache first
                if (RulesetsLoaderApi.idbChecksumsCache.has(cacheKey)) {
                    idbChecksum = RulesetsLoaderApi.idbChecksumsCache.get(cacheKey);
                } else {
                    // Not in cache - go to database
                    idbChecksum = await RulesetsLoaderApi.getValueFromIdb(
                        RulesetsLoaderApi.getKey(RulesetsLoaderApi.KEY_PREFIX_CHECKSUM, rulesetId),
                    );
                    // Only cache if we found a value to avoid storing undefined
                    if (idbChecksum) {
                        RulesetsLoaderApi.idbChecksumsCache.set(cacheKey, idbChecksum);
                    }
                }

                if (idbChecksum === checksum) {
                    return;
                }

                const rulesetIdNumber = extractRulesetId(rulesetId);
                if (!rulesetIdNumber) {
                    throw new Error(`Invalid rule set id: ${rulesetId}`);
                }

                logger.info(`[tsweb.RulesetsLoaderApi.syncRulesetWithIdb]: Syncing rule set with IDB: ${rulesetId} (previous checksum: ${idbChecksum}, current checksum: ${checksum})`);

                const rulesetPath = getRulesetPath(rulesetId, this.rulesetsPath);
                const rawRuleset = await fetchExtensionResourceText(browser.runtime.getURL(rulesetPath));

                const parsedRuleset = JSON.parse(rawRuleset);
                const { metadata } = parsedRuleset[0];

                const { filterContent } = metadata;

                // TODO: AG-53262 — Measure cold start time after migration
                // from rawFilterList+conversionData → filterContent.
                // FilterList.prepare() now runs at runtime (was build-time).
                // Could add ~100-200ms per 100k+ line filter on first start.
                const filterList = new FilterList(filterContent);
                const rawFilterList = filterList.getContent();
                const conversionData = filterList.getConversionData();

                const db = await RulesetsLoaderApi.getOpenedDb(RulesetsLoaderApi.DB_STORE_NAME);
                const tx = db.transaction(RulesetsLoaderApi.DB_STORE_NAME, 'readwrite');
                const store = tx.objectStore(RulesetsLoaderApi.DB_STORE_NAME);

                const puts = [
                    store.put(
                        checksum,
                        RulesetsLoaderApi.getKey(RulesetsLoaderApi.KEY_PREFIX_CHECKSUM, rulesetId),
                    ),
                    store.put(
                        JSON.stringify(metadata.metadata),
                        RulesetsLoaderApi.getKey(RulesetsLoaderApi.KEY_PREFIX_RULESET_METADATA, rulesetId),
                    ),
                    store.put(
                        JSON.stringify(metadata.lazyMetadata),
                        RulesetsLoaderApi.getKey(RulesetsLoaderApi.KEY_PREFIX_RULESET_LAZY_METADATA, rulesetId),
                    ),
                    store.put(
                        JSON.stringify(parsedRuleset.slice(1)),
                        RulesetsLoaderApi.getKey(RulesetsLoaderApi.KEY_PREFIX_RULESET_DECLARATIVE_RULES, rulesetId),
                    ),
                ];

                await Promise.all(puts);

                await tx.done;

                await FiltersStorage.setMultiple({
                    [rulesetIdNumber]: {
                        rawFilterList,
                        conversionData,
                        checksum,
                    },
                });

                // After updating cache in db we should update it in memory cache
                RulesetsLoaderApi.idbChecksumsCache.set(cacheKey, checksum);

                // Invalidate the ruleset cache since the data has changed
                RulesetsLoaderApi.rulesetsCache.delete(rulesetId);

                logger.info(`[tsweb.RulesetsLoaderApi.syncRulesetWithIdb]: Synced rule set with IDB: ${rulesetId}, checksum: ${checksum}`);
            } catch (err) {
                logger.error(`[tsweb.RulesetsLoaderApi.syncRulesetWithIdb]: Failed to sync rule set ${rulesetId}:`, err);
                throw err;
            } finally {
                RulesetsLoaderApi.syncLocks.delete(rulesetId);
            }
        })();

        RulesetsLoaderApi.syncLocks.set(rulesetId, syncPromise);
        await syncPromise;
    }

    /**
     * If the rule set with the provided ID is already loaded, it will
     * be returned from the cache. Otherwise, it will create a new {@link IRulesetWithSourceMap}
     * from the provided ID and list of {@link IFilter|filters} with lazy
     * loading of this rule set contents.
     *
     * @param rulesetId Rule set id.
     * @param filterList List of all available {@link IFilter|filters}.
     *
     * @returns New {@link IRulesetWithSourceMap}.
     *
     * @throws If initialization fails or the rule set with the provided ID is not found or invalid.
     */
    public async createRuleset(
        rulesetId: string,
        filterList: IFilter[],
    ): Promise<IRulesetWithSourceMap> {
        const rulesetIdNumber = extractRulesetId(rulesetId);

        if (rulesetIdNumber === null) {
            throw new Error(`Invalid rule set id: ${rulesetId}`);
        }

        const rulesetCache = RulesetsLoaderApi.rulesetsCache.get(rulesetId);
        if (rulesetCache) {
            return rulesetCache;
        }

        if (!this.isInitialized) {
            await this.initialize();
        }

        await this.syncRulesetWithIdb(rulesetId);

        const rawData = await RulesetsLoaderApi.getValueFromIdb(
            RulesetsLoaderApi.getKey(RulesetsLoaderApi.KEY_PREFIX_RULESET_METADATA, rulesetId),
        );

        const loadLazyData = async (): Promise<string> => RulesetsLoaderApi.getValueFromIdb(
            RulesetsLoaderApi.getKey(RulesetsLoaderApi.KEY_PREFIX_RULESET_LAZY_METADATA, rulesetId),
        );

        const loadDeclarativeRules = (): Promise<string> => RulesetsLoaderApi.getValueFromIdb(
            RulesetsLoaderApi.getKey(RulesetsLoaderApi.KEY_PREFIX_RULESET_DECLARATIVE_RULES, rulesetId),
        );

        const {
            data: {
                regexpRulesCount,
                unsafeRulesCount,
                safeRulesCount,
                unsafeRules,
                badFilterRulesRaw,
                rulesetHashMapRaw,
            },
            rulesetContentProvider,
        } = await RulesetWithSourceMap.deserialize(
            rulesetId,
            rawData,
            loadLazyData,
            loadDeclarativeRules,
            filterList,
        );

        // Build badFilterRules and rulesHashMap eagerly from the already-loaded
        // metadata. With the new API these are plain fields (not lazy providers).
        // We don't need filterId / ruleIndex because these Rule instances are
        // used only for $badfilter matching, not for source attribution.
        const badFilterRules = badFilterRulesRaw
            .flatMap((rawString) => Rule.createFromText(0, 0, rawString));

        const sources = RulesHashMap.deserializeSources(rulesetHashMapRaw);
        const rulesHashMap = new RulesHashMap(sources);

        const ruleset = new RulesetWithSourceMap(
            rulesetId,
            safeRulesCount,
            unsafeRulesCount,
            regexpRulesCount,
            rulesetContentProvider,
            badFilterRules,
            rulesHashMap,
            unsafeRules,
        );

        if (filterList.some((f) => f.getId() === rulesetIdNumber)) {
            // We save the rule set in the cache only if its filter is loaded.
            RulesetsLoaderApi.rulesetsCache.set(rulesetId, ruleset);
        }

        return ruleset;
    }
}
