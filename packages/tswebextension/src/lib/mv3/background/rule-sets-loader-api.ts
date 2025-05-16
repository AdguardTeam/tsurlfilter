import { RuleParser } from '@adguard/agtree';
import { fetchExtensionResourceText, FilterListPreprocessor } from '@adguard/tsurlfilter';
import {
    type IFilter,
    type IRuleSet,
    RuleSet,
    IndexedNetworkRuleWithHash,
    RulesHashMap,
    MetadataRuleSet,
    METADATA_RULESET_ID,
} from '@adguard/tsurlfilter/es/declarative-converter';
import { extractRuleSetId, getRuleSetId, getRuleSetPath } from '@adguard/tsurlfilter/es/declarative-converter-utils';
import browser from 'webextension-polyfill';
import { type IDBPDatabase } from 'idb';

import { IdbSingleton } from '../../common/idb-singleton';
import { FiltersStorage } from '../../common/storage/filters';
import { logger } from '../../common/utils/logger';
import { getErrorMessage } from '../../common/error';

/**
 * RuleSetsLoaderApi is responsible for creating {@link IRuleSet} instances from provided rule set IDs and paths.
 * It supports lazy loading, meaning the rule set contents are loaded only upon request.
 *
 * This class also manages a cache of metadata rule sets to optimize performance and reduce redundant fetches.
 *
 * The main functionalities include:
 * - Initializing the rule sets loader to prepare it for fetching rule sets.
 * - Fetching checksums of rule sets.
 * - Fetching specific byte ranges of rule sets to minimize memory usage.
 * - Creating new {@link IRuleSet} instances with lazy loading capabilities.
 *
 * @example
 * ```typescript
 * const loader = new RuleSetsLoaderApi('/path/to/rulesets');
 * await loader.initialize();
 * const ruleSet = await loader.createRuleSet('123', filters);
 * ```
 */
export class RuleSetsLoaderApi {
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
    private static metadataRulesetsCache: Record<string, MetadataRuleSet> = {};

    /**
     * Cache for already created rulesets. Needed to avoid multiple loading
     * of the same ruleset.
     */
    private static ruleSetsCache: Map<string, IRuleSet>;

    /**
     * Path to rule sets cache directory to invalidate it when path changes.
     */
    private static ruleSetsCachePath: string;

    /**
     * Path to rule sets directory.
     */
    private ruleSetsPath: string;

    /**
     * Indicates whether the rule sets loader is initialized.
     */
    private isInitialized: boolean;

    /**
     * Promise that resolves when the initialization is complete.
     * This helps prevent multiple fetches by ensuring {@link RuleSetsLoaderApi.initialize}
     * is only called once, even if invoked multiple times in quick succession.
     */
    private initializerPromise: Promise<void> | undefined;

    /**
     * Cache of checksums of rule sets.
     */
    private static idbChecksumsCache = new Map<string, string | undefined>();

    /**
     * Race condition lock map per ruleSetId.
     */
    private syncLocks: Map<string, Promise<void>>;

    /**
     * Creates new {@link RuleSetsLoaderApi}.
     *
     * @param ruleSetsPath Path to rule sets directory.
     */
    constructor(ruleSetsPath: string) {
        this.ruleSetsPath = ruleSetsPath;
        this.isInitialized = false;
        this.syncLocks = new Map();

        if (RuleSetsLoaderApi.ruleSetsCachePath !== ruleSetsPath) {
            RuleSetsLoaderApi.ruleSetsCachePath = ruleSetsPath;
            RuleSetsLoaderApi.ruleSetsCache = new Map();
        }
    }

    /**
     * Returns key with prefix.
     * Key format: <prefix>_<ruleSetId>, e.g. `metadata_123`.
     *
     * @param keyPrefix Key prefix.
     * @param ruleSetId Rule set id.
     *
     * @returns Key with prefix.
     */
    private static getKey(keyPrefix: string, ruleSetId: number | string): string {
        return `${keyPrefix}${RuleSetsLoaderApi.KEY_COMBINER}${ruleSetId}`;
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
            RuleSetsLoaderApi.idbChecksumsCache.clear();
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
        const db = await RuleSetsLoaderApi.getOpenedDb(RuleSetsLoaderApi.DB_STORE_NAME);
        const tx = db.transaction(RuleSetsLoaderApi.DB_STORE_NAME, 'readonly');
        const store = tx.objectStore(RuleSetsLoaderApi.DB_STORE_NAME);

        const value = await store.get(key);

        await tx.done;

        return value;
    }

    /**
     * Gets the checksums of the rule sets.
     *
     * @param ruleSetId Rule set id.
     *
     * @returns Checksums of the rule sets.
     *
     * @throws If the rule sets loader is not initialized or the checksum for the specified rule set is not found.
     */
    private async getChecksum(ruleSetId: string | number): Promise<string | undefined> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const ruleSetIdWithPrefix = getRuleSetId(ruleSetId);

        return RuleSetsLoaderApi.metadataRulesetsCache[this.ruleSetsPath]?.getChecksum(ruleSetIdWithPrefix);
    }

    /**
     * Initializes the rule sets loader.
     * It is needed to be called before any other method, because it loads byte range maps collection,
     * which is used to fetch certain parts of the rule set files instead of the whole files
     * and makes possible to use less memory.
     *
     * @throws Error if the byte range maps collection file is not found or its content is invalid.
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
                if (!RuleSetsLoaderApi.metadataRulesetsCache[this.ruleSetsPath]) {
                    const metadataRulesetPath = getRuleSetPath(METADATA_RULESET_ID, this.ruleSetsPath);
                    const rawMetadataRuleset = await fetchExtensionResourceText(
                        browser.runtime.getURL(metadataRulesetPath),
                    );
                    // eslint-disable-next-line max-len
                    RuleSetsLoaderApi.metadataRulesetsCache[this.ruleSetsPath] = MetadataRuleSet.deserialize(rawMetadataRuleset);
                }

                this.isInitialized = true;
                this.initializerPromise = undefined;
            } catch (error) {
                logger.error('Failed to initialize RuleSetsLoaderApi. Got error:', getErrorMessage(error));
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
     * @param ruleSetId Rule set id.
     */
    public async syncRuleSetWithIdb(ruleSetId: string): Promise<void> {
        // Use a per-ruleSet lock to avoid parallel syncs
        const existingLock = this.syncLocks.get(ruleSetId);
        if (existingLock) {
            await existingLock;
            return;
        }

        const syncPromise = (async (): Promise<void> => {
            try {
                if (!this.isInitialized) {
                    await this.initialize();
                }

                const checksum = await this.getChecksum(ruleSetId);
                if (!checksum) {
                    return;
                }

                let idbChecksum: string | undefined;

                const cacheKey = `${this.ruleSetsPath}_${ruleSetId}`;

                if (RuleSetsLoaderApi.idbChecksumsCache.has(cacheKey)) {
                    idbChecksum = RuleSetsLoaderApi.idbChecksumsCache.get(cacheKey);
                } else {
                    idbChecksum = await RuleSetsLoaderApi.getValueFromIdb(
                        RuleSetsLoaderApi.getKey(RuleSetsLoaderApi.KEY_PREFIX_CHECKSUM, ruleSetId),
                    );
                    RuleSetsLoaderApi.idbChecksumsCache.set(cacheKey, idbChecksum);
                }

                if (idbChecksum === checksum) {
                    return;
                }

                const ruleSetIdNumber = extractRuleSetId(ruleSetId);
                if (!ruleSetIdNumber) {
                    throw new Error(`Invalid rule set id: ${ruleSetId}`);
                }

                // eslint-disable-next-line max-len
                logger.info(`Syncing rule set with IDB: ${ruleSetId} (previous checksum: ${idbChecksum}, current checksum: ${checksum})`);

                const ruleSetPath = getRuleSetPath(ruleSetId, this.ruleSetsPath);
                const rawRuleSet = await fetchExtensionResourceText(browser.runtime.getURL(ruleSetPath));

                const parsedRuleSet = JSON.parse(rawRuleSet);
                const { metadata } = parsedRuleSet[0];

                const db = await RuleSetsLoaderApi.getOpenedDb(RuleSetsLoaderApi.DB_STORE_NAME);
                const tx = db.transaction(RuleSetsLoaderApi.DB_STORE_NAME, 'readwrite');
                const store = tx.objectStore(RuleSetsLoaderApi.DB_STORE_NAME);

                const puts = [
                    store.put(
                        checksum,
                        RuleSetsLoaderApi.getKey(RuleSetsLoaderApi.KEY_PREFIX_CHECKSUM, ruleSetId),
                    ),
                    store.put(
                        JSON.stringify(metadata.metadata),
                        RuleSetsLoaderApi.getKey(RuleSetsLoaderApi.KEY_PREFIX_RULESET_METADATA, ruleSetId),
                    ),
                    store.put(
                        JSON.stringify(metadata.lazyMetadata),
                        RuleSetsLoaderApi.getKey(RuleSetsLoaderApi.KEY_PREFIX_RULESET_LAZY_METADATA, ruleSetId),
                    ),
                    store.put(
                        JSON.stringify(parsedRuleSet.slice(1)),
                        RuleSetsLoaderApi.getKey(RuleSetsLoaderApi.KEY_PREFIX_RULESET_DECLARATIVE_RULES, ruleSetId),
                    ),
                ];

                await Promise.all(puts);

                await tx.done;

                const { conversionMap, rawFilterList } = metadata;

                const preprocessedFilterList = FilterListPreprocessor.preprocessLightweight({
                    rawFilterList,
                    conversionMap,
                });

                await FiltersStorage.setMultiple({
                    [ruleSetIdNumber]: {
                        ...preprocessedFilterList,
                        checksum,
                    },
                });

                logger.info(`Synced rule set with IDB: ${ruleSetId}`);
            } catch (err) {
                logger.error(`Failed to sync rule set ${ruleSetId}:`, getErrorMessage(err));
                throw err;
            } finally {
                this.syncLocks.delete(ruleSetId);
            }
        })();

        this.syncLocks.set(ruleSetId, syncPromise);
        await syncPromise;
    }

    /**
     * If the rule set with the provided ID is already loaded, it will
     * be returned from the cache. Otherwise, it will create a new {@link IRuleSet}
     * from the provided ID and list of {@link IFilter|filters} with lazy
     * loading of this rule set contents.
     *
     * @param ruleSetId Rule set id.
     * @param filterList List of all available {@link IFilter|filters}.
     *
     * @returns New {@link IRuleSet}.
     *
     * @throws If initialization fails or the rule set with the provided ID is not found.
     */
    public async createRuleSet(
        ruleSetId: string,
        filterList: IFilter[],
    ): Promise<IRuleSet> {
        const ruleSetCache = RuleSetsLoaderApi.ruleSetsCache.get(ruleSetId);
        if (ruleSetCache) {
            return ruleSetCache;
        }

        if (!this.isInitialized) {
            await this.initialize();
        }

        await this.syncRuleSetWithIdb(ruleSetId);

        const rawData = await RuleSetsLoaderApi.getValueFromIdb(
            RuleSetsLoaderApi.getKey(RuleSetsLoaderApi.KEY_PREFIX_RULESET_METADATA, ruleSetId),
        );

        const loadLazyData = async (): Promise<string> => RuleSetsLoaderApi.getValueFromIdb(
            RuleSetsLoaderApi.getKey(RuleSetsLoaderApi.KEY_PREFIX_RULESET_LAZY_METADATA, ruleSetId),
        );

        const loadDeclarativeRules = (): Promise<string> => RuleSetsLoaderApi.getValueFromIdb(
            RuleSetsLoaderApi.getKey(RuleSetsLoaderApi.KEY_PREFIX_RULESET_DECLARATIVE_RULES, ruleSetId),
        );

        const {
            data: {
                regexpRulesCount,
                unsafeRulesCount,
                rulesCount,
                ruleSetHashMapRaw,
                badFilterRulesRaw,
            },
            ruleSetContentProvider,
        } = await RuleSet.deserialize(
            ruleSetId,
            rawData,
            loadLazyData,
            loadDeclarativeRules,
            filterList,
        );

        const sources = RulesHashMap.deserializeSources(ruleSetHashMapRaw);
        const ruleSetHashMap = new RulesHashMap(sources);
        // We don't need filter id and line index because this
        // indexedRulesWithHash will be used only for matching $badfilter rules.
        const badFilterRules = badFilterRulesRaw
            .map((rawString) => IndexedNetworkRuleWithHash.createFromNode(0, 0, RuleParser.parse(rawString)))
            .flat();

        const ruleset = new RuleSet(
            ruleSetId,
            rulesCount,
            // it is ok to set 0 since this method is used for static rulesets where unsafe rules are not used
            unsafeRulesCount || 0,
            regexpRulesCount,
            ruleSetContentProvider,
            badFilterRules,
            ruleSetHashMap,
        );

        RuleSetsLoaderApi.ruleSetsCache.set(ruleSetId, ruleset);

        return ruleset;
    }
}
